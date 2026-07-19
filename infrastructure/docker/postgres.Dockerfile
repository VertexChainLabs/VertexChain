# syntax=docker/dockerfile:1.7
#
# VertexChain Postgres
#
# Multi-arch: postgres:16-alpine ships multi-arch manifests (amd64 + arm64).
# Pinning --platform=$TARGETPLATFORM ensures the correct variant is pulled
# when the image is built as part of a `docker buildx` multi-arch build.

ARG TARGETPLATFORM

FROM --platform=$TARGETPLATFORM postgres:16-alpine

ENV POSTGRES_USER=vertexchain \
    POSTGRES_PASSWORD=vertexchain \
    POSTGRES_DB=vertexchain

# Custom init scripts run in alphabetical order on first start
COPY postgres-init.sql /docker-entrypoint-initdb.d/01-init.sql

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" || exit 1

EXPOSE 5432
