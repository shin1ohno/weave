# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.7](https://github.com/shin1ohno/weave/compare/weave-server-v0.1.6...weave-server-v0.1.7) - 2026-04-28

### Other

- refresh default glyphs with centred bitmaps + senic-hub additions ([#63](https://github.com/shin1ohno/weave/pull/63))
- prefilter cross-edge ServiceState fan-out by recipient's active mappings ([#61](https://github.com/shin1ohno/weave/pull/61))
- sort find_edge_for_service candidates by semver, not String ([#60](https://github.com/shin1ohno/weave/pull/60))
- scope cross-edge service_state fan-out to v0.13.0+ edges ([#59](https://github.com/shin1ohno/weave/pull/59))
- fan out cross-edge service_state to peer edges ([#58](https://github.com/shin1ohno/weave/pull/58))
- weave-server + weave-web: enforce single-active-per-device invariant on mapping.active ([#57](https://github.com/shin1ohno/weave/pull/57))
- [draft] device-level Connection cycle (server-side) ([#53](https://github.com/shin1ohno/weave/pull/53))
- dedup device tiles + match firing by device_id (Hue Tap Dial multi-edge) ([#52](https://github.com/shin1ohno/weave/pull/52))
- forward EdgeToServer::DispatchIntent to capability-matching edge ([#51](https://github.com/shin1ohno/weave/pull/51))
- device control buttons (Connect / Disconnect / Test LED A) in DeviceTile ([#48](https://github.com/shin1ohno/weave/pull/48))
- D2 conversation-builder Routes editor + persisted Templates ([#47](https://github.com/shin1ohno/weave/pull/47))
- surface edge wifi + RTT in /ws/ui dashboards ([#46](https://github.com/shin1ohno/weave/pull/46))
- A2 connections-first design fidelity pass ([#41](https://github.com/shin1ohno/weave/pull/41))

## [0.1.6](https://github.com/shin1ohno/weave/compare/weave-server-v0.1.5...weave-server-v0.1.6) - 2026-04-26

### Other

- fix Connection create from LAN hostname; add Nuimo firing diagnostics ([#36](https://github.com/shin1ohno/weave/pull/36))

## [0.1.5](https://github.com/shin1ohno/weave/compare/weave-server-v0.1.4...weave-server-v0.1.5) - 2026-04-23

### Other

- live stream panel — commands, state, errors, filtered, z-40 drawer ([#30](https://github.com/shin1ohno/weave/pull/30))
- cargo fmt api.rs preset description
- Routes editor rebuild + preset API + inline expand

## [0.1.4](https://github.com/shin1ohno/weave/compare/weave-server-v0.1.3...weave-server-v0.1.4) - 2026-04-22

### Other

- cross-service target candidates (server + engine + web UI) ([#25](https://github.com/shin1ohno/weave/pull/25))

## [0.1.3](https://github.com/shin1ohno/weave/compare/weave-server-v0.1.2...weave-server-v0.1.3) - 2026-04-21

### Added
- `EdgeToServer::SwitchTarget` WebSocket handler that reuses the REST `switch_target` code path, enabling on-device target selection commits from edge-agents.
- Programmatically-seeded A-Z (5x7) + 00-99 (3x5 digit pair) glyph set — 126 entries auto-upserted on every startup so Web UI + edge-agents share a consistent alphabet for candidate labels.
- `Mapping.target_candidates` + `Mapping.target_switch_on` persistence (schema change lives in weave-contracts 0.3).

## [0.1.2](https://github.com/shin1ohno/weave/compare/weave-server-v0.1.1...weave-server-v0.1.2) - 2026-04-20

### Other

- update Cargo.lock dependencies
