# Stage 1: Build gosu with a patched Go version to fix CVE-2026-42504
FROM golang:1.26.5-alpine AS gosu-builder
RUN apk add --no-cache git
WORKDIR /go/src/github.com/tianon/gosu
RUN git clone https://github.com/tianon/gosu.git . && \
    git checkout 1.17 && \
    CGO_ENABLED=0 go build -ldflags '-d -s -w' -o /go/bin/gosu

# Stage 2: Final postgres image
FROM postgres:16-alpine

ENV POSTGRES_USER=vertexchain \
    POSTGRES_PASSWORD=vertexchain \
    POSTGRES_DB=vertexchain

# Update system packages and replace vulnerable pre-installed gosu with custom built binary
COPY --from=gosu-builder /go/bin/gosu /usr/local/bin/gosu
RUN apk update && apk upgrade && \
    apk add --no-cache ca-certificates && \
    rm -rf /var/cache/apk/*

# Custom init scripts run in alphabetical order on first start
COPY postgres-init.sql /docker-entrypoint-initdb.d/01-init.sql

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" || exit 1

EXPOSE 5432
