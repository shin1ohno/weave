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

## Recurring bug: empty Live Console panels despite server having data

**Symptom**: browsing `http://pro.home.local:3100/` loads the page, but Edges / Zones / Lights / Mappings all show their empty fallback text (`No edges have ever connected.` etc.) even though:
- `curl http://pro.home.local:3101/api/mappings` returns real data
- a WebSocket probe against `pro.home.local:3100/ws/ui` from the CLI receives a full `{"type":"snapshot", ...}` frame within milliseconds

The HTML body that curl returns always shows the empty-state fallback — that's the SSR pre-hydration text, overwritten client-side once the WS delivers a snapshot. So SSR text is a red herring; judge the real UI from a running browser only.

**Root cause** (seen multiple times on this network): `pro.home.local` resolves to 2–3 different IPs via mDNS / router DNS. `pro` itself has two NICs (enp11s0 on 192.168.1.162, enp12s0 on 192.168.1.21, enp25s0 on 192.168.1.20 — the two `/16` NICs both serve :3100 through the 0.0.0.0 bind). A third IP in that pool (e.g. 192.168.1.22) is a stale lease for a long-gone NIC, still advertised in mDNS / the router. Browsers round-robin or cache-per-query across the IP set, so the HTTP fetch lands on a working IP but a later WebSocket open can hit the ghost IP and time out silently. The page renders fine, the WS is dead, the panels stay on SSR fallback.

**Diagnosis**:
```
$ host pro.home.local
pro.home.local has address 192.168.1.20
pro.home.local has address 192.168.1.21
pro.home.local has address 192.168.1.22

$ for ip in 192.168.1.20 192.168.1.21 192.168.1.22; do
    curl -sS -o /dev/null -w "$ip -> %{http_code}\n" --max-time 2 http://$ip:3100/
  done
192.168.1.20 -> 200
192.168.1.21 -> 200
192.168.1.22 -> 000        # <-- ghost IP, browser may still hit it
```

Open DevTools → Network → WS filter on the affected tab. If the `ws/ui` request is `Pending` or `failed`, this is the case. If `101 Switching Protocols` and messages are flowing, the bug is elsewhere.

**Fix (user-facing)**:
1. Load the page with an explicit working IP: `http://192.168.1.20:3100/` (or `.21`).
2. Hard-reload (Cmd/Ctrl+Shift+R) — DNS caches may pin different IPs per tab.

**Fix (permanent)** — pick one:
- Remove the stale mDNS advertiser. Check the router's DHCP reservation table; release the old lease for `pro.home.local` / `pro.local`. If pro has a legacy interface config holding `.22`, remove it.
- Bind Docker port publishes to a single interface IP instead of `0.0.0.0` so only one address serves :3100 reliably (least flexible, last resort).
- Serve weave-web behind a real reverse proxy on a single LAN IP + real hostname (e.g. `weave.home.local`) separate from the multi-IP `pro.home.local`.

**Do NOT**:
- Assume the page is broken just because SSR-rendered HTML shows empty state. Always confirm via a browser where JS executes.
- Spend time rebuilding docker images to "fix" this — the build side is fine; the rebuild wastes 3+ minutes.
- Assume WS proxy through Next.js rewrites is broken — `{ source: "/ws/:path*", destination: ... }` does preserve WebSocket upgrades; `curl -H "Upgrade: websocket"` confirms.

## Release-plz

Rust crates (`weave-server`, `weave-engine`, `weave-contracts`) auto-release via release-plz on push to main. `semver_check = false` is set intentionally in `release-plz.toml` — 0.1.0's `Cargo.toml.orig` was published with a stale edge-agent path dep, which breaks release-plz's git-checkout of that historical commit. 0.1.0 is yanked; 0.1.1+ is clean. Re-evaluate `semver_check = true` after enough version history has clean manifests.

`weave-web/package.json` is NOT auto-released — it's a private Next.js app, not a crate.
