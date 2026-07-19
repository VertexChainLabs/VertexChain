# syntax=docker/dockerfile:1.7
#
# VertexChain Contract Builder (Soroban / Rust → WASM)
#
# Multi-arch: the builder stage always runs on BUILDPLATFORM because the
# output is architecture-independent WebAssembly. No QEMU emulation needed.
# The `scratch` artifacts stage carries only the .wasm files, which are
# platform-neutral.
#
# BUILDPLATFORM is an automatic ARG injected by Docker Buildx —
# do NOT declare it manually, that overrides it with an empty string.
# See: https://docs.docker.com/engine/reference/builder/#automatic-platform-args-in-the-global-scope

FROM --platform=$BUILDPLATFORM rust:1.82-slim AS builder

RUN rustup target add wasm32v1-none \
 && cargo install soroban-cli --locked

WORKDIR /workspace
COPY . .

RUN cargo build --release --target wasm32v1-none

FROM scratch AS artifacts
COPY --from=builder /workspace/target/wasm32v1-none/release/*.wasm /
