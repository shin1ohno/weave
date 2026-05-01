# weave

IoT device ↔ service routing infrastructure. Translate physical gestures (Nuimo rotate / button / swipe / touch / long-touch / fly / hover, Hue Tap Dial buttons + dial) into service commands (Roon play/volume, Hue brightness, macOS audio, Apple Music on iPad, room target switches). Mappings are configuration — change them without touching code.

Two independent paths share the same config store:

- **Direct `edge-agent` path** (recommended, low latency): a per-host [`edge-agent`](https://github.com/shin1ohno/edge-agent) binary speaks BLE locally, consumes Hue v2 SSE for Tap Dial input, and talks to services via their native SDKs (Roon API, Hue CLIP v2) plus an MQTT bridge to the macOS audio host (`macos-hub`) and the iPad media app (`WeaveIos`). Round-trip on Nuimo rotate → Roon volume is <10 ms on a LAN.
- **MQTT path** (N:N cross-host): device drivers (`nuimo-mqtt`) and service adapters (`roon-hub`) publish/subscribe over an MQTT broker. The routing engine stays on `weave-server`. Useful when you can't run a binary on the device's host.

Both paths pull their mappings from the same `weave-server` HTTP API + SQLite store, so a single Web UI configures everything.

## Big picture

The system spans **four GitHub repos** that build three kinds of artifacts: hardware SDKs, a control-plane server, and per-host edge binaries. Everything meets at `weave-server`, which is the only stateful component.

```
Physical devices                  Edges (one per host)                 Control plane              Web UI
──────────────────                ────────────────────                 ─────────────              ────────

  Nuimo × N (BLE)                                                                               ┌─────────────┐
  Hue Tap Dial (over Hue SSE)                                                                   │  weave-web  │
  iPad keyboards                                                                                │  Next.js +  │
     │                                                                                          │  Catalyst   │
     │  BlueZ / CoreBluetooth / Hue v2 SSE                                                      └──────┬──────┘
     ▼                                                                                                 │
  ┌──────────┐   SDK / MQTT   ┌──────────────────────┐                ┌───────────────┐                │ HTTP
  │ nuimo-rs │◄───────────────┤ edge-agent           │   /ws/edge     │ weave-server  │ /ws/ui         │
  │ (SDK)    │   bluer /      │  ├ edge_core         │ ──────────────►│  (axum+sqlx)  │ ◄─────────────►┤
  │          │   btleplug     │  ├ adapter_roon      │  ConfigFull    │               │  snapshot      │
  │ nuimo-   │                │  ├ adapter_hue       │  ConfigPatch   │  SQLite       │  + frames
  │ mqtt ──┐ │                │  ├ adapter_macos     │  GlyphsUpdate  │  mappings     │                │
  │ (MQTT) │ │                │  ├ adapter_ios_media │  TargetSwitch  │  glyphs       │ REST           │
  └────────┼─┘                │  └ ws_client         │  ◄── State     │  edges        │ ◄──────────────┘
           │ MQTT             └─┬─────┬─────┬────┬───┘                │               │
           ▼                    │     │     │    │                    │  /api/*       │
       ┌────────┐               │ Roon│ Hue │ MQTT (mosquitto)        └───────────────┘
       │ mosqui-│               │ API │ CLIPv2 + SSE                         ▲
       │ tto    │◄──────────────┘     ▼     │                                │
       └───┬────┘              ┌──────────┐ │   ┌──────────────┐            MQTT bridge
           │ MQTT              │ Hue      │ │   │ macos-hub    │            (optional, ServerToEdge)
           ▼                   │ Bridge   │ │   │ on Mac       │
       ┌────────────┐          │ (lights, │ │   │ Core Audio + │
       │ Roon Core  │◄─────┐   │ Tap Dial)│ │   │ MediaRemote  │
       │ (Zones)    │      │   └──────────┘ │   └──────────────┘
       └────────────┘      │                │           ▲
                           │   ┌──────────┐ │           │ MQTT (service/macos/...)
                           │   │ roon-hub │ │           │
                           └───┤ (MQTT    ├─┘   ┌──────────────────┐
                               │ bridge)  │     │ WeaveIos (iPad)  │
                               └──────────┘     │ Apple Music ctrl │
                                                └──────────────────┘
                                                    │ MQTT
                                                    ▼ (service/ios_media/...)
```

### Repo → artifact map

| Repo | Crates / apps | What ships where |
|---|---|---|
| [**shin1ohno/weave**](https://github.com/shin1ohno/weave) (this) | `weave-engine`, `weave-server`, `weave-web` | crates.io (server, engine) + Docker image (web). The control plane. |
| [**shin1ohno/edge-agent**](https://github.com/shin1ohno/edge-agent) | `weave-contracts`, `edge-core`, `nuimo-protocol`, `weave-ios-core`, `edge-agent` | crates.io. Per-host binary + supporting crates (routing engine, Nuimo wire-format parsers, iOS-side runtime, WS protocol types). The same workspace also ships the `companions/mac/macos-hub` Mac bridge and the SwiftUI `WeaveIos` iPad app under `ios/`. |
| [**shin1ohno/nuimo-rs**](https://github.com/shin1ohno/nuimo-rs) | `nuimo`, `nuimo-mqtt` | crates.io. Nuimo BLE SDK (used by `edge-agent` for Linux + macOS desktop hosts) + optional MQTT bridge. |
| [**shin1ohno/roon-rs**](https://github.com/shin1ohno/roon-rs) | `roon-api`, `roon-cli`, `roon-mcp`, `roon-hub` | crates.io. Roon SOOD/MOO SDK (used by `edge-agent`) + `roon-hub` MQTT bridge (pulled via `cargo install` from this repo's compose). |
| [**shin1ohno/setup**](https://github.com/shin1ohno/setup) | mitamae cookbooks | Per-host config management. Cookbooks `edge-agent`, `macos-hub`, `weave-server` install + wire up everything above on Linux + macOS targets. |

### End-to-end: one Nuimo rotate tick (direct path)

1. User rotates Nuimo. The knob emits a BLE notification on a GATT characteristic.
2. `nuimo` SDK (inside `edge-agent`) decodes it into a `NuimoEvent::Rotate { delta }`.
3. `edge-agent`'s `edge_core::routing` looks up the mapping for `(nuimo/<device_id>, rotate)` and builds an `Intent::VolumeChange { delta }`.
4. `adapter_roon` converts the intent into a `roon-api` `Transport::change_volume` RPC, serialized over Roon's MOO protocol to the Core.
5. The Core updates the zone's volume; Roon pushes a `ZoneEvent::Changed` back.
6. `adapter_roon` emits a `StateUpdate` (property=`volume`, property=`playback`, etc.).
7. `spawn_state_pump` forwards it as an `EdgeToServer::State` frame over `/ws/edge`.
8. `weave-server` stores it and broadcasts a `UiFrame` over `/ws/ui`.
9. `weave-web`'s `UIStateProvider` applies the frame; `ZonesPanel` re-renders with the new volume.
10. `FeedbackPlan` (still inside `edge-agent`) picks a glyph (`volume_bar` parametrized by the new level) and writes it to the Nuimo LED over BLE — visible to the user ~10 ms after step 1.

The MQTT path replaces steps 2–4 / 6–7 with `nuimo-mqtt` ↔ `mosquitto` ↔ `weave-server` ↔ `mosquitto` ↔ `roon-hub` and adds one broker round-trip.

### Which path to pick

| Situation | Direct `edge-agent` | MQTT |
|---|---|---|
| One Nuimo near one host running the Roon Core | ✓ recommended | over-engineered |
| Multiple Nuimos on the same host | ✓ (multi-Nuimo supervisor) | possible |
| Hue Tap Dial as input device | ✓ (forwarded over Hue v2 SSE) | not supported |
| Mac is the speaker host, Linux owns Roon + Nuimos | ✓ (`macos-hub` bridge over MQTT) | ✓ |
| iPad as a portable edge for Apple Music | ✓ (`WeaveIos` + `adapter_ios_media`) | not supported |
| Latency-critical (volume twiddle) | ✓ <10 ms | 20–60 ms + broker hop |
| Devices / services span 3+ hosts with sparse overlap | reasonable | ✓ better |
| Zero binary installs on device host | — | ✓ (MQTT-only) |

Ops detail lives in the per-repo READMEs; the canonical [`compose.yml`](./compose.yml) brings up mosquitto + roon-hub + weave-server + weave-web together. See [`CLAUDE.md`](./CLAUDE.md) for the deploy topology and the one-time volume-migration script (for anyone moving off the previous `roon-rs/compose.yml` location).

## Components in this repo

| Path | What it is |
|---|---|
| [`crates/weave-engine`](./crates/weave-engine) | Pure-Rust routing core (input primitive → service intent). No network/storage concerns; used by both `weave-server` and `edge-agent`. Published to crates.io. |
| [`crates/weave-server`](./crates/weave-server) | Control-plane binary: REST API for mappings, WebSocket push to edges (`/ws/edge`) and Web UI (`/ws/ui`), SQLite persistence, optional MQTT bridge. Published to crates.io. |
| [`weave-web`](./weave-web) | Next.js + Tailwind (Catalyst UI kit) dashboard: edges, zones, Hue lights, mapping editor, glyph editor, target-selection candidates, live state. Container-only (not published). |

Sibling repos:

- [shin1ohno/edge-agent](https://github.com/shin1ohno/edge-agent) — per-host binary for the direct path, plus the `weave-contracts` crate that defines the `/ws/edge` protocol (shared with `weave-server`).
- [shin1ohno/nuimo-rs](https://github.com/shin1ohno/nuimo-rs) — Rust SDK for Nuimo Control.
- [shin1ohno/roon-rs](https://github.com/shin1ohno/roon-rs) — Rust Roon API bindings, plus the `roon-hub` MQTT bridge binary used by the MQTT path.

## Feature highlights

- **Multiple input controllers per edge**: one Linux host can supervise N Nuimos (each with independent BLE session, event loop, feedback pump, and reconnect cycle) plus any Hue Tap Dial Switches paired to the bridge. Hot-plug works — a Nuimo powered on after edge-agent startup is picked up automatically.
- **Multiple service back-ends**: Roon (direct API), Philips Hue (CLIP v2 + bridge SSE for both lights and Tap Dial input), macOS audio (Core Audio output switching + MediaRemote play/pause + system volume, via `macos-hub`), Apple Music on iPad (via the `WeaveIos` companion app over `adapter_ios_media`). Add new `service_type`s by implementing the `ServiceAdapter` trait.
- **Live config push**: edit a mapping via REST or UI → `ConfigPatch` arrives at the owning edge within one round-trip. No edge-agent restart.
- **Zone / target switching from the device**: a mapping can declare `target_switch_on` (e.g. `swipe_up`) + a list of `target_candidates`. Swipe to enter mode, rotate to browse, press to commit — selection glyph previewed on the device LED during the pick.
- **Glyph library**: 138 pre-seeded 9×9 LED glyphs (play/pause/next/previous/link/bulb/light_on/light_off/music_note/shuffle/power_off, A–Z, 00–99), centred to the matrix middle and auto-refreshed on every startup so bitmap revisions propagate without a DB wipe; plus a full ASCII grid editor for custom glyphs.
- **Feedback rules**: service state → device feedback (Roon `playback: playing` → `play` glyph, `paused` → `pause` glyph, volume → parametric volume bar that flips direction for dB-style negative-range zones; Hue `on=true` → `bulb`, `on=false` → `light_off`).
- **Service-aware volume rendering**: linear 0..N zones fill the LED bottom-up; dB zones (max=0, min<0) fill top-down so `0 dB` reads as "top indicator on, bar hanging down" instead of "empty bar".
- **Full upstream Nuimo gesture vocabulary**: button (down/up), rotate, swipe (×4 directions, physical surface), touch + long-touch (×4 edges), fly (×2 directions, in-air wave above the device — distinct from swipe), hover proximity, battery level. Hue Tap Dial adds `button_1..=4` + rotate.
- **Multi-stage glyph picker** in the Web UI (All / Letters / Numbers / Other → glyph select → inline preview) for candidate + feedback rule editing.

## Quick start

### Docker Compose (one-host smoke test)

The [`compose.yml`](./compose.yml) in this repo brings up `mosquitto`, `roon-hub`, `weave-server`, and `weave-web` together. It's self-contained — `roon-hub` is installed from crates.io inside its Dockerfile, so no sibling repo checkout is required:

```
git clone git@github.com:shin1ohno/weave.git
cd weave
docker compose up -d --build
```

Then:

- Web UI: <http://localhost:3100>
- REST / WS: `http://localhost:3101/api/mappings`, `ws://localhost:3101/ws/edge`, `ws://localhost:3101/ws/ui`

> **Trusted LAN only.** This exposes REST, WebSocket, and MQTT without authentication. See [Operational Assumptions](#operational-assumptions) before opening any of these ports beyond a household network.

### Standalone `weave-server`

```
cargo install weave-server
WEAVE_DATABASE_URL=sqlite:///var/lib/weave/weave.db?mode=rwc \
API_PORT=3001 \
weave-server
```

Point an [`edge-agent`](https://github.com/shin1ohno/edge-agent) at `ws://HOST:3001/ws/edge` and you're routing.

### Web UI dev

```
cd weave-web
npm install
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
```

## Configuration

Everything mutable lives in the SQLite store behind the REST API. A `Mapping` record binds one (edge, device) → one (service, target), plus:

- `routes[]` — ordered `input → intent` rules (e.g. `rotate → volume_change` with a `damping` factor)
- `feedback[]` — `state → glyph` projections (show `play` glyph when `playback` becomes `playing`)
- `target_candidates[]` + `target_switch_on` — optional per-device target-selection mode
- `active: bool` — kill switch without deleting the mapping

Glyphs are JSON rows with a 9×9 ASCII pattern (`*` = on, anything else = off).

See [`SPEC.md`](./SPEC.md) for the full data model, API surface, and design rationale.

## Operational Assumptions

This system bakes in the following assumptions. If any of them don't hold in your deployment, treat it as a redesign signal, not a config change.

### Trust boundary

- Trusted LAN only. No authentication on `/ws/edge`, `/ws/ui`, `/api/*`, or the MQTT broker.
- Anyone on the same network segment can impersonate an edge, edit mappings, and control the bound Roon / Hue endpoints.
- Not designed for: multi-tenant, internet-exposed, guest-Wi-Fi bridged, or IoT-VLAN-crossing deployments.
- To go wider: front `weave-server` with a reverse proxy that terminates mTLS or an auth layer, and lock down the mosquitto broker with ACLs before touching network topology.

### Target deployment scale

- Primary: one household, ≤ 5 devices, 1–2 edges.
- Secondary (tested, works): small office, ≤ 10 edges, single `weave-server`.
- Out of scope today: N > 10 edges, multi-site, geographic distribution, HA `weave-server` (SQLite single instance, no replication).
- Config push has no canary. A typo in the UI reaches every edge bound to that mapping in one WebSocket round-trip.

### Latency boundary (what `<10 ms` means)

- Measured from: BLE GATT notification received on the edge host.
- Measured to: Roon MOO `change_volume` RPC buffered to socket (adapter-side send).
- **Not** measured: physical rotation → audible volume change. The full chain adds Roon Core scheduling + DAC latency and is outside weave's control.
- Median on LAN with Linux BlueZ + local Roon Core. p99 can exceed 50 ms on BLE reconnect or Roon extension re-handshake.
- Hard floor: BLE connection interval (7.5–30 ms on typical peripherals) bounds how often rotate ticks can physically arrive.
- MQTT path adds one broker hop: roughly +10–50 ms on a local mosquitto, more on remote brokers.

### Compatibility policy

- `weave-contracts` is the wire contract between `weave-server` and `edge-agent`. Treat it as a published API.
- Today's semver rules:
  - **MINOR** — struct field addition (all structs tolerate unknown/missing fields via `#[serde(default)]`).
  - **MAJOR** — enum variant addition on `ServerToEdge` / `EdgeToServer` / `UiFrame` / `PatchOp`. These are `#[serde(tag = "type")]` with no `#[serde(other)]` fallback, so unknown variants are hard errors on old peers.
  - **MAJOR** — field rename or removal.
- Rolling-upgrade order:
  - New `EdgeToServer` variant (edge → server): deploy `edge-agent` first.
  - New `ServerToEdge` variant (server → edge): deploy `weave-server` first.
  - Struct field additions: order doesn't matter.
- Installs from crates.io can mix versions. `cargo install weave-server` + an independently built `edge-agent` is **not** a supported combination unless their `weave-contracts` minor versions match.

## Related reading

- [`SPEC.md`](./SPEC.md) — requirements, architecture, data model, protocol, deployment topology
- `crates/weave-server/CHANGELOG.md` / `crates/weave-engine/CHANGELOG.md` — release history

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT License ([LICENSE-MIT](LICENSE-MIT))

at your option.
