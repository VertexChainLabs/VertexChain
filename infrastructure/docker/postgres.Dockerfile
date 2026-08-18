# syntax=docker/dockerfile:1.7
#
# VertexChain Postgres
#
# Multi-arch: postgres:16-alpine ships multi-arch manifests (amd64 + arm64).
# Pinning --platform=$TARGETPLATFORM ensures the correct variant is pulled
# when the image is built as part of a `docker buildx` multi-arch build.
#
# Security: gosu is rebuilt from source against a patched Go toolchain to
# remediate the Go stdlib CVEs (CVE-2026-33818, CVE-2026-39821,
# CVE-2026-46600, CVE-2026-56853, CVE-2026-56858, CVE-2026-56859,
# CVE-2026-56860, CVE-2026-56862) in the binary shipped with the upstream image.
#
# BUILDPLATFORM and TARGETPLATFORM are automatic ARGs injected by Buildx —
# do NOT declare them manually, that overrides them with empty strings.
# See: https://docs.docker.com/engine/reference/builder/#automatic-platform-args-in-the-global-scope

# Stage 1: Build gosu with a patched Go version (1.26.6) to remediate the
# Go stdlib CVEs above. Run on BUILDPLATFORM so the Go compiler executes
# natively (no QEMU).
FROM --platform=$BUILDPLATFORM golang:1.26.6-alpine AS gosu-builder
RUN apk add --no-cache git
WORKDIR /go/src/github.com/tianon/gosu
RUN git clone https://github.com/tianon/gosu.git . && \
    git checkout 1.17 && \
    CGO_ENABLED=0 go build -ldflags '-d -s -w' -o /go/bin/gosu

# Stage 2: Final postgres image pinned to TARGETPLATFORM for multi-arch.
FROM --platform=$TARGETPLATFORM postgres:16-alpine

ENV POSTGRES_USER=vertexchain \
    POSTGRES_PASSWORD=vertexchain \
    POSTGRES_DB=vertexchain

# Replace vulnerable pre-installed gosu with custom-built binary.
COPY --from=gosu-builder /go/bin/gosu /usr/local/bin/gosu
RUN apk update && apk upgrade && \
    apk add --no-cache ca-certificates && \
    rm -rf /var/cache/apk/*

# Custom init scripts run in alphabetical order on first start
COPY postgres-init.sql /docker-entrypoint-initdb.d/01-init.sql

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" || exit 1

EXPOSE 5432
