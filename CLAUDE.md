# weave — project-local notes

## Deploy topology

The canonical docker-compose lives in the sibling repo `~/ManagedProjects/roon-rs/compose.yml`, not in this repo. `weave` itself only ships Dockerfiles (`crates/weave-server/Dockerfile`, `weave-web/Dockerfile`); the composition is in roon-rs because the full home-audio stack needs mosquitto + roon-hub (roon-rs code) alongside weave-server + weave-web.

**Stack composition (`roon-rs/compose.yml`):**

| Service | Build context | Ports | Notes |
|---|---|---|---|
| mosquitto | `eclipse-mosquitto:2` | 1883 | MQTT broker, healthcheck-gated |
| roon-hub | `roon-rs` | — | Depends on mosquitto |
| weave-server | `../weave` (sibling) | 3101→3001 | `WEAVE_DISABLE_MQTT=1` by default |
| weave-web | `../weave/weave-web` | 3100→3000 | Proxies `/api` and `/ws` to weave-server |

**Not in the stack**: `edge-agent` runs natively on each BLE-adjacent host (systemd/user service) because it needs host bluez/D-Bus access. Its ws target is `ws://<docker-host>:3101/ws/edge`.

**Deploy command** (from `~/ManagedProjects/roon-rs`):
```
docker compose up -d --build
```

Browser URL: `http://<host>:3100` (not 3000 — 3000 is commonly taken locally).

**When a weave change needs deploying**: both `weave-web` and `weave-server` images are built fresh from source on every `docker compose up --build`, so there's no image tag to bump — just pull the latest commit on the host that runs compose, then `up -d --build`. If a host doesn't have a `weave` checkout alongside `roon-rs`, compose will fail at build time (context is `../weave`).

## First-time Roon pairing

After `roon-hub` starts, approve **roon-hub** in Roon → Settings → Extensions. The edge-agent registers as its own Extension (unique `extension_id`) and needs independent approval.

## Cookbook-managed vs deploy-dir files

Changes to `weave-web/Dockerfile` or `crates/*/Dockerfile` land in this repo; compose / mosquitto / roon-hub config files live in roon-rs. When fixing a deploy-time bug, check which repo owns the file before editing.

## Release-plz

Rust crates (`weave-server`, `weave-engine`, `weave-contracts`) auto-release via release-plz on push to main. `semver_check = false` is set intentionally in `release-plz.toml` — 0.1.0's `Cargo.toml.orig` was published with a stale edge-agent path dep, which breaks release-plz's git-checkout of that historical commit. 0.1.0 is yanked; 0.1.1+ is clean. Re-evaluate `semver_check = true` after enough version history has clean manifests.

`weave-web/package.json` is NOT auto-released — it's a private Next.js app, not a crate.
