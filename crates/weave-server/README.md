# weave-server

Control-plane binary for the [weave](https://github.com/shin1ohno/weave) project.

Serves two concurrent paths:

- **Direct path** (low-latency): edge-agent binaries connect via WebSocket to sync config and state
- **MQTT path** (N:N cross-host): `weave-engine` routes input primitives to service adapters via an MQTT broker

Persistence is SQLite; mappings are editable via REST + a Next.js UI.

## Install

```
cargo install weave-server
```

## Run

```
WEAVE_DATABASE_URL=sqlite:///var/lib/weave/weave.db?mode=rwc \
API_PORT=3001 \
weave-server
```

Docker image: `ghcr.io/shin1ohno/weave-server`.

See [SPEC.md](https://github.com/shin1ohno/weave/blob/main/SPEC.md) for the full architecture.

## License

MIT
