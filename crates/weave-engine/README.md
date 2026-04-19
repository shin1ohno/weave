# weave-engine

Routing engine for the [weave](https://github.com/shin1ohno/weave) project.

Maps input primitives from IoT devices (rotate, press, long_press, swipe, slide, hover) to service intents (play, volume_change, next, brightness_change) according to a configurable, persisted mapping store.

## Role in weave

`weave-engine` is the pure-Rust routing core consumed by:

- [`weave-server`](https://crates.io/crates/weave-server) — HTTP/WebSocket/MQTT control plane
- edge-agent binaries running on device hosts

It has no network or storage concerns of its own: the store trait is implementation-agnostic (SQLite, in-memory, etc.).

## Example

```rust
use weave_engine::{Engine, Primitive, Intent};
// wire your store, feed primitives, receive intents
```

See [the project SPEC](https://github.com/shin1ohno/weave/blob/main/SPEC.md) for the full architecture.

## License

MIT
