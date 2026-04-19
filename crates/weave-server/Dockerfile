# Build context = weave repo root. weave-contracts is resolved from crates.io.
FROM rust:1-bookworm AS builder
WORKDIR /build
COPY . .
RUN cargo build --release -p weave-server

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /var/lib/weave \
    && useradd --system --home /var/lib/weave --uid 1001 weave \
    && chown -R weave:weave /var/lib/weave
COPY --from=builder /build/target/release/weave-server /usr/local/bin/weave-server
COPY --from=builder /build/crates/weave-server/migrations /etc/weave/migrations
USER weave
ENV WEAVE_DATABASE_URL=sqlite:///var/lib/weave/weave.db?mode=rwc \
    API_PORT=3001
EXPOSE 3001
ENTRYPOINT ["/usr/local/bin/weave-server"]
