# weave

IoT device ↔ service routing infrastructure. Translate physical IoT gestures (Nuimo rotate, button press, swipe, long-press, etc.) into service commands (Roon play/volume, Hue brightness, room target switches). Mappings are configuration — change them without touching code.

Two independent paths share the same config store:

- **Direct `edge-agent` path** (recommended, low latency): a per-host [`edge-agent`](https://github.com/shin1ohno/edge-agent) binary speaks BLE/USB locally and talks to services via their native SDKs (Roon API, Hue CLIP v2). Round-trip on Nuimo rotate → Roon volume is <10 ms on a LAN.
- **MQTT path** (N:N cross-host): device drivers (`nuimo-mqtt`) and service adapters (`roon-hub`) publish/subscribe over an MQTT broker. The routing engine stays on `weave-server`. Useful when you can't run a binary on the device's host.

Both paths pull their mappings from the same `weave-server` HTTP API + SQLite store, so a single Web UI configures everything.

## Big picture

The system spans **four GitHub repos** that build three kinds of artifacts: hardware SDKs, a control-plane server, and per-host edge binaries. Everything meets at `weave-server`, which is the only stateful component.

```
Physical devices                 Edges (one per host)                  Control plane              Web UI
──────────────────               ────────────────────                  ─────────────              ────────

  Nuimo (BLE)                                                                                   ┌─────────────┐
     │                                                                                          │  weave-web  │
     │  BlueZ / CoreBluetooth                                                                   │  Next.js +  │
     ▼                                                                                          │  Catalyst   │
  ┌──────────┐   native SDK    ┌──────────────────┐                    ┌───────────────┐        └──────┬──────┘
  │ nuimo-rs │◄────────────────┤ edge-agent       │   /ws/edge         │ weave-server  │ /ws/ui        │ HTTP
  │ (SDK)    │    bluer /      │  ├ edge_core     │ ─────────────────► │  (axum+sqlx)  │ ◄────────────►┤
  │          │    btleplug     │  ├ adapter_roon  │   ConfigFull       │               │  snapshot     │
  │ nuimo-   │                 │  ├ adapter_hue   │   ConfigPatch      │  SQLite       │  + frames
  │ mqtt ──┐ │                 │  └ ws_client     │   GlyphsUpdate     │  mappings     │               │
  │ (MQTT) │ │                 └───┬────────┬─────┘   TargetSwitch     │  glyphs       │ REST          │
  └────────┼─┘                     │        │         ◄── State (pump) │  edges        │ ◄─────────────┘
           │ MQTT                  │ Roon   │ Hue                      │               │
           ▼                       │ API    │ CLIP v2                  │  /api/*       │
       ┌────────┐                  ▼        ▼                          └───────────────┘
       │ mosqui-│          ┌──────────┐  ┌──────────┐
       │ tto    │          │ roon-rs  │  │ (Hue     │
       └───┬────┘          │ (SDK)    │  │  bridge) │
           │ MQTT          │          │  └──────────┘
           ▼               │ roon-hub │
       ┌────────────┐      │ (MQTT    │
       │ Roon Core  │◄─────┤ bridge)  │
       │ (Zones,    │      └──────────┘
       │  Outputs)  │
       └────────────┘
```

### Repo → artifact map

| Repo | Crates / apps | What ships where |
|---|---|---|
| [**shin1ohno/weave**](https://github.com/shin1ohno/weave) (this) | `weave-engine`, `weave-server`, `weave-web` | crates.io (server, engine) + Docker image (web). The control plane. |
| [**shin1ohno/edge-agent**](https://github.com/shin1ohno/edge-agent) | `weave-contracts`, `edge-agent` | crates.io. Per-host binary + WS protocol types shared with `weave-server`. |
| [**shin1ohno/nuimo-rs**](https://github.com/shin1ohno/nuimo-rs) | `nuimo`, `nuimo-mqtt` | crates.io. Nuimo BLE SDK (used by `edge-agent`) + optional MQTT bridge. |
| [**shin1ohno/roon-rs**](https://github.com/shin1ohno/roon-rs) | `roon-api`, `roon-cli`, `roon-mcp`, `roon-hub` | crates.io. Roon SOOD/MOO SDK (used by `edge-agent`) + `roon-hub` MQTT bridge (pulled via `cargo install` from this repo's compose). |

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
| Nuimo on Mac, Roon Core on Linux NAS, Hue bridge on router | ✓ (run an edge-agent on Mac, one on NAS) | ✓ |
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

- **Live config push**: edit a mapping via REST or UI → `ConfigPatch` arrives at the owning edge within one round-trip. No edge-agent restart.
- **Zone / target switching from the device**: a mapping can declare `target_switch_on` (e.g. `swipe_up`) + a list of `target_candidates`. Swipe to enter mode, rotate to browse, press to commit — selection glyph previewed on the device LED during the pick.
- **Glyph library**: 132 pre-seeded 9×9 LED glyphs (play/pause/next/previous/link, A–Z, 00–99), auto-populated on every startup; plus a full ASCII grid editor for custom glyphs.
- **Feedback rules**: service state → device feedback (Roon `playback: playing` → `play` glyph, `paused` → `pause` glyph, volume → parametric volume bar that flips direction for dB-style negative-range zones).
- **Service-aware volume rendering**: linear 0..N zones fill the LED bottom-up; dB zones (max=0, min<0) fill top-down so `0 dB` reads as "top indicator on, bar hanging down" instead of "empty bar".
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

## Related reading

- [`SPEC.md`](./SPEC.md) — requirements, architecture, data model, protocol, deployment topology
- `crates/weave-server/CHANGELOG.md` / `crates/weave-engine/CHANGELOG.md` — release history

## License

MIT. See individual crate `Cargo.toml` for the canonical license declaration (`license = "MIT"` per crate).
