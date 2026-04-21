# roon-hub runtime image. Built against the crates.io release of `roon-hub`
# so this repo has zero dependency on a sibling roon-rs checkout — the
# binary is pulled from the registry like any third-party tool.
#
# Version is pinned here (not "--version *") so compose builds are
# reproducible across hosts. Bump this line when a newer roon-hub ships.

FROM rust:1-bookworm AS builder
WORKDIR /build
# `--locked` refuses to resolve with a stale Cargo.lock, forcing the
# registry version's committed lockfile to be used verbatim.
RUN cargo install roon-hub --version 0.5.1 --locked --root /out

FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /out/bin/roon-hub /usr/local/bin/roon-hub
WORKDIR /etc/roon-hub
ENTRYPOINT ["roon-hub"]
CMD ["/etc/roon-hub/roon-hub.toml"]
