# Build context must be the parent of the weave/ and edge-agent/ repos so
# the `weave-contracts` path dep resolves. See the compose.yml for how the
# context is set up.
FROM rust:1-bookworm AS builder
WORKDIR /build
# edge-agent is a Cargo workspace; weave-contracts inherits edition from
# workspace.package so the root Cargo.toml must be present. `members =
# ["crates/*"]` resolves against whatever is actually copied, so shipping
# just the one crate directory is enough.
COPY edge-agent/Cargo.toml ./edge-agent/Cargo.toml
COPY edge-agent/crates/weave-contracts ./edge-agent/crates/weave-contracts
COPY weave ./weave
WORKDIR /build/weave
RUN cargo build --release -p weave-server

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /var/lib/weave \
    && useradd --system --home /var/lib/weave --uid 1001 weave \
    && chown -R weave:weave /var/lib/weave
COPY --from=builder /build/weave/target/release/weave-server /usr/local/bin/weave-server
COPY --from=builder /build/weave/crates/weave-server/migrations /etc/weave/migrations
USER weave
ENV WEAVE_DATABASE_URL=sqlite:///var/lib/weave/weave.db?mode=rwc \
    API_PORT=3001
EXPOSE 3001
ENTRYPOINT ["/usr/local/bin/weave-server"]
