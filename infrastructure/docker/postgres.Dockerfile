FROM postgres:16-alpine

ENV POSTGRES_USER=vertexchain \
    POSTGRES_PASSWORD=vertexchain \
    POSTGRES_DB=vertexchain

# Update system packages to patch vulnerabilities
RUN apk update && apk upgrade && \
    apk add --no-cache ca-certificates && \
    rm -rf /var/cache/apk/*

# Custom init scripts run in alphabetical order on first start
COPY postgres-init.sql /docker-entrypoint-initdb.d/01-init.sql

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" || exit 1

EXPOSE 5432
