# weave

IoT device ↔ service routing infrastructure. Translate physical IoT gestures (Nuimo rotate, button press, swipe, long-press, etc.) into service commands (Roon play/volume, Hue brightness, room target switches). Mappings are configuration — change them without touching code.

Two independent paths share the same config store:

- **Direct `edge-agent` path** (recommended, low latency): a per-host [`edge-agent`](https://github.com/shin1ohno/edge-agent) binary speaks BLE/USB locally and talks to services via their native SDKs (Roon API, Hue CLIP v2). Round-trip on Nuimo rotate → Roon volume is <10 ms on a LAN.
- **MQTT path** (N:N cross-host): device drivers (`nuimo-mqtt`) and service adapters (`roon-hub`) publish/subscribe over an MQTT broker. The routing engine stays on `weave-server`. Useful when you can't run a binary on the device's host.

Both paths pull their mappings from the same `weave-server` HTTP API + SQLite store, so a single Web UI configures everything.

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

The sibling [`roon-rs`](https://github.com/shin1ohno/roon-rs) repo ships a `compose.yml` that brings up `mosquitto`, `roon-hub`, `weave-server`, and `weave-web` together:

```
git clone git@github.com:shin1ohno/roon-rs.git
git clone git@github.com:shin1ohno/weave.git
cd roon-rs
docker compose up -d
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
