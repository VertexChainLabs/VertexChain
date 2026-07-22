# syntax=docker/dockerfile:1.7
#
# VertexChain Contract Builder (Soroban / Rust → WASM)
#
# Multi-arch: the builder stage always runs on BUILDPLATFORM because the
# output is architecture-independent WebAssembly. No QEMU emulation needed.
# The `scratch` artifacts stage carries only the .wasm files, which are
# platform-neutral.
#
# Why no soroban-cli / stellar install:
#   The actual contract artefacts are produced by plain `cargo build` targeting
#   wasm32v1-none. The `stellar` CLI is only needed for deployment (stellar
#   contract deploy) which happens outside this image. Skipping `cargo install
#   soroban-cli` cuts the builder layer from ~15 min to under 5 min and removes
#   the openssl-sys / dbus transitive dependency tangle.
#   wasm32v1-none is available from Rust 1.84+, so we pin rust:1.84-slim.
#
# BUILDPLATFORM is an automatic ARG injected by Docker Buildx —
# do NOT declare it manually, that overrides it with an empty string.
# See: https://docs.docker.com/engine/reference/builder/#automatic-platform-args-in-the-global-scope

FROM --platform=$BUILDPLATFORM rust:1.84-slim AS builder

# wasm32v1-none is the only wasm target accepted by the Soroban/Stellar
# runtime. It is available from Rust 1.84 (pinned above).
RUN rustup target add wasm32v1-none

WORKDIR /workspace
COPY . .

# --locked enforces the workspace Cargo.lock so crate versions are pinned,
# giving reproducible artefacts identical to what `cargo test` verified.
RUN cargo build --locked --release --target wasm32v1-none

FROM scratch AS artifacts
COPY --from=builder /workspace/target/wasm32v1-none/release/*.wasm /
