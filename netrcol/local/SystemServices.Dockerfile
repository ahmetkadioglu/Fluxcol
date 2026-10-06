# SPDX-License-Identifier: AGPL-3.0-or-later

# Compile the two services together to share their Rust dependency build.
FROM rust:1-trixie AS builder
WORKDIR /usr/src/app
COPY . .
ENV CARGO_BUILD_JOBS=2
RUN cargo test --locked -p fluxer-users -p fluxer-messages --features scylla && \
    cargo build --locked --release -p fluxer-users -p fluxer-messages --features scylla

FROM debian:trixie-slim AS runtime
ARG BUILD_VERSION="netrcol-local"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.source="https://github.com/fluxerapp/fluxer"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL app.fluxer.build-version="${BUILD_VERSION}"
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /usr/local/bin
ENV BUILD_VERSION="${BUILD_VERSION}"
USER 65532:65532
EXPOSE 8090

FROM runtime AS users
LABEL org.opencontainers.image.title="netrcol-fluxer-users"
COPY --from=builder /usr/src/app/target/release/fluxer-users /usr/local/bin/fluxer-users
CMD ["/usr/local/bin/fluxer-users"]

FROM runtime AS messages
LABEL org.opencontainers.image.title="netrcol-fluxer-messages"
COPY --from=builder /usr/src/app/target/release/fluxer-messages /usr/local/bin/fluxer-messages
CMD ["/usr/local/bin/fluxer-messages"]
