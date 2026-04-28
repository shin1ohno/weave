# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.4](https://github.com/shin1ohno/weave/compare/weave-engine-v0.1.3...weave-engine-v0.1.4) - 2026-04-28

### Other

- [draft] device-level Connection cycle (server-side) ([#53](https://github.com/shin1ohno/weave/pull/53))
- filter GesturePicker by device_type so Hue Tap Dial buttons surface ([#50](https://github.com/shin1ohno/weave/pull/50))
- D2 conversation-builder Routes editor + persisted Templates ([#47](https://github.com/shin1ohno/weave/pull/47))

## [0.1.3](https://github.com/shin1ohno/weave/compare/weave-engine-v0.1.2...weave-engine-v0.1.3) - 2026-04-22

### Other

- cross-service target candidates (server + engine + web UI) ([#25](https://github.com/shin1ohno/weave/pull/25))

## [0.1.2](https://github.com/shin1ohno/weave/compare/weave-engine-v0.1.1...weave-engine-v0.1.2) - 2026-04-21

### Other

- Baseline republish. No code changes since 0.1.1 — the bump moves the release-plz package-equality baseline past a stretch of commits that carried a temporary `[patch.crates-io]` with a sibling-dir `path=` in the workspace root. release-plz's historical-commit `cargo metadata` step would fail on those commits, blocking all auto-release runs; this clean re-publish lets future release-plz walks start from the current (clean) main.

## [0.1.1](https://github.com/shin1ohno/weave/releases/tag/weave-engine-v0.1.1) - 2026-04-19

### Other

- Initial publish after the weave-engine crate split.
