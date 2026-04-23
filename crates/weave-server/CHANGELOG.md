# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
