# syntax=docker/dockerfile:1.7
#
# VertexChain Backend — infrastructure variant
#
# Multi-arch: builds for linux/amd64 and linux/arm64 via `docker buildx`.
# BUILDPLATFORM and TARGETPLATFORM are automatic ARGs injected by Buildx —
# do NOT declare them manually, that overrides them with empty strings.
# See: https://docs.docker.com/engine/reference/builder/#automatic-platform-args-in-the-global-scope

ARG NODE_VERSION=20

# ---------- deps ----------
# Run on BUILDPLATFORM so npm/node native addons compile on the host arch.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---------- build ----------
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- runner ----------
# Run on TARGETPLATFORM so the final image is the correct arch.
FROM --platform=$TARGETPLATFORM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=deps    --chown=nestjs:nodejs /app/node_modules ./node_modules
USER nestjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/main"]
