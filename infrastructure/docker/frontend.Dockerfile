# syntax=docker/dockerfile:1.7
#
# VertexChain Frontend — infrastructure variant (nginx static export)
#
# Multi-arch: builds for linux/amd64 and linux/arm64 via `docker buildx`.
# BUILDPLATFORM  = host platform (compile stages run here, no QEMU needed).
# TARGETPLATFORM = target image platform (runtime stage uses this).

ARG NODE_VERSION=20
ARG BUILDPLATFORM
ARG TARGETPLATFORM

# ---------- deps ----------
# Run on BUILDPLATFORM so npm/node native addons compile on the host arch.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---------- build ----------
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runner ----------
# nginx:1.27-alpine ships multi-arch manifests for amd64 and arm64.
FROM --platform=$TARGETPLATFORM nginx:1.27-alpine AS runner
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY --from=builder /app/out ./
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost/ping || exit 1
CMD ["nginx", "-g", "daemon off;"]
