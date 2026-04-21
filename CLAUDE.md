# weave — project-local notes

## Deploy topology

The canonical compose file is `compose.yml` **in this repo**. roon-rs is a sibling checkout only because roon-hub still builds from source there:

```
~/ManagedProjects/weave      ← this repo, compose.yml lives here
~/ManagedProjects/roon-rs    ← sibling, roon-hub Dockerfile lives here
```

**Stack composition (`compose.yml`):**

| Service | Build context | Ports | Notes |
|---|---|---|---|
| mosquitto | `eclipse-mosquitto:2` | 1883 | MQTT broker, healthcheck-gated |
| roon-hub | `../roon-rs` (sibling) | — | Depends on mosquitto |
| weave-server | `.` (this repo) | 3101→3001 | `WEAVE_DISABLE_MQTT=1` by default |
| weave-web | `./weave-web` | 3100→3000 | Proxies `/api` and `/ws` to weave-server |

Compose project name is pinned to `weave` (`name: weave` in `compose.yml`) so running `docker compose` from any directory keeps the same volume namespace.

**Not in the stack**: `edge-agent` runs natively on each BLE-adjacent host (systemd/user service) because it needs host bluez/D-Bus access. Its ws target is `ws://<docker-host>:3101/ws/edge`.

**Deploy command** (from `~/ManagedProjects/weave`):
```
docker compose up -d --build
```

Browser URL: `http://<host>:3100` (not 3000 — 3000 is commonly taken locally).

**When a weave change needs deploying**: both `weave-web` and `weave-server` images are built fresh from source on every `docker compose up --build`, so there's no image tag to bump — just pull the latest commit on the host that runs compose, then `up -d --build`. If a host doesn't have a `roon-rs` checkout alongside `weave`, compose will fail at build time (roon-hub's context is `../roon-rs`).

### One-time migration from the old `roon-rs/compose.yml` location

The compose file previously lived in `roon-rs/`, which put existing volumes under the `roon-rs_*` namespace (`roon-rs_weave-data`, `roon-rs_mosquitto-data`, …). After moving here the project name becomes `weave`, so a naïve `docker compose up` creates empty `weave_*` volumes and loses the SQLite mappings store.

To migrate without data loss — **run once** on the host that holds the old volumes:

```
# 1. Stop the old stack so nothing is writing.
cd ~/ManagedProjects/roon-rs && docker compose down

# 2. Copy each volume under the new name.
for v in weave-data mosquitto-data mosquitto-log roon-hub-data; do
  docker volume create "weave_${v}"
  docker run --rm \
    -v "roon-rs_${v}:/src:ro" \
    -v "weave_${v}:/dst" \
    alpine sh -c "cp -a /src/. /dst/"
done

# 3. Bring up the new stack.
cd ~/ManagedProjects/weave && docker compose up -d --build

# 4. Verify. Mappings should list pre-existing entries, and edges should
#    reconnect on their own.
curl -s http://127.0.0.1:3101/api/mappings | python3 -m json.tool | head

# 5. Once confirmed, remove the old volumes.
docker volume rm roon-rs_weave-data roon-rs_mosquitto-data \
  roon-rs_mosquitto-log roon-rs_roon-hub-data
```

After this migration the sibling `roon-rs/compose.yml` and `roon-rs/deploy/` can be removed in a follow-up PR to roon-rs.

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
