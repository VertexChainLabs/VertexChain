# VertexChain API

The backend API and on-chain indexer for VertexChain. This service is the bridge between the web client and both the Stellar/Soroban blockchain and the Postgres database.

## What This Repo Does

- **Indexes** on-chain events from the `GistRegistry` Soroban contract
- **Stores** enriched gist data in Postgres + PostGIS for fast geospatial queries
- **Exposes** a REST API consumed by the VertexChain frontend
- **Bridges** to IPFS/Pinata for full gist content storage (the chain only holds a hash)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Runtime | Node.js >= 20 |
| Framework | NestJS |
| Database | PostgreSQL 15 + PostGIS extension |
| ORM / Query | TypeORM (with PostGIS support) |
| Blockchain | Stellar Horizon + Soroban RPC |
| Storage bridge | IPFS via Pinata (or self-hosted node) |
| Config | `@nestjs/config` with typed configuration |
| Testing | Jest (built into NestJS) |

---

## Project Layout

```
Backend/
├── src/
│   ├── main.ts                    # App bootstrap
│   ├── app.module.ts              # Root module
│   ├── config/
│   │   └── configuration.ts      # Typed config via @nestjs/config
│   ├── gists/                     # Gist feature module
│   │   ├── gists.module.ts
│   │   ├── gists.controller.ts    # Route handlers
│   │   ├── gists.service.ts       # Business logic
│   │   ├── dto/
│   │   │   ├── create-gist.dto.ts
│   │   │   └── query-gists.dto.ts
│   │   └── entities/
│   │       └── gist.entity.ts
│   ├── indexer/                   # Soroban event watcher
│   │   ├── indexer.module.ts
│   │   └── indexer.service.ts
│   ├── soroban/                   # Soroban RPC client wrapper
│   │   ├── soroban.module.ts
│   │   └── soroban.service.ts
│   ├── ipfs/                      # IPFS pinning service
│   │   ├── ipfs.module.ts
│   │   └── ipfs.service.ts
│   └── geo/                       # Geospatial helpers (geohash encoding)
│       └── geo.service.ts
├── test/                          # e2e tests
├── .env.example
├── package.json
└── README.md
```

---

## Prerequisites

- **Node.js** >= 20 — [nodejs.org](https://nodejs.org)
- **PostgreSQL 15** with the **PostGIS extension**
- **npm** (comes with Node.js)

> **Why PostGIS?** The core feature of VertexChain is querying gists by distance — *"show me everything within 500m of these coordinates."* PostGIS adds a spatial index that makes this instant, even at scale.

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/VertexChainLabs/VertexChain.git
cd VertexChain/Backend
npm install
```

### 2. Set up Postgres + PostGIS

**Option A — Docker (quickest)**

```bash
docker run -d \
  --name vertexchain-db \
  -e POSTGRES_USER=gist \
  -e POSTGRES_PASSWORD=gist \
  -e POSTGRES_DB=gist \
  -p 5432:5432 \
  postgis/postgis:15-3.3
```

**Option B — Homebrew (macOS)**

```bash
brew install postgresql@15 postgis
brew services start postgresql@15
psql -U postgres -c "CREATE USER gist WITH PASSWORD 'gist';"
psql -U postgres -c "CREATE DATABASE gist OWNER gist;"
psql -U gist -d gist -c "CREATE EXTENSION postgis;"
```

### 3. Environment variables

```bash
cp .env.example .env
```

Fill in the values — minimum required for local dev are the `DATABASE_*` fields.

### 4. Start the dev server

```bash
npm run start:dev
```

API available at: `http://localhost:3000`

---

## API Overview

### Health

```
GET /health
```

Returns `{ "status": "ok" }`.

### Query Gists by Location

```
GET /gists?lat=5.6037&lon=-0.1870&radius=500&limit=20&cursor=
```

| Param | Type | Default | Description |
|---|---|---|---|
| `lat` | number | required | Latitude |
| `lon` | number | required | Longitude |
| `radius` | number | `500` | Radius in metres (max 5000) |
| `limit` | number | `20` | Max results (max 100) |
| `cursor` | string | — | Pagination cursor |

### Create a Gist

```
POST /gists
Content-Type: application/json
```

```json
{
  "lat": 5.6037,
  "lon": -0.1870,
  "text": "Great street food here tonight",
  "authorAddress": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
}
```

`authorAddress` is optional — anonymous posting is fully supported.

**Idempotency.** Send an `Idempotency-Key` header (any unique string, e.g. a UUID) on every post. The server records a durable write attempt *before* the irreversible on-chain call and replays it on retry, so a client that retries after a mid-write failure gets the original gist instead of a second on-chain record. If the header is omitted, the server derives a deterministic key from the request content, so identical retries still deduplicate. Reusing a key with a *different* body returns `422`.

**What happens internally:**
1. Validate + sanitise input
2. Pin content to IPFS → receive CID
3. Derive `locationCell` from `(lat, lon)` via geohash
4. Persist a `pending` write attempt (keyed by the idempotency key) in Postgres
5. Submit `post_gist(author, locationCell, contentHash)` to Soroban
6. Record the on-chain `gistId`/`txHash` (`chained`) and insert the `gists` row (`committed`)
7. Return the created gist

### Correct a Gist

```
PATCH /gists/{id}
Content-Type: application/json
```

```json
{
  "content": "Great street food here tonight (fixed typo)",
  "author": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
}
```

Lets an author fix a typo shortly after posting — but only shortly after:

- **60-second edit window.** Measured from the gist's `created_at`. Once elapsed, the endpoint returns `410 Gone` and the content is permanent.
- **Author-gated.** `author` must match the gist's stored author exactly, or the endpoint returns `403 Forbidden`. Gists posted without an author (fully anonymous) can never be edited — there's no identity to verify against.
- **Lineage preserved.** The prior IPFS CID is kept in `previous_cid` and the new content is re-pinned to IPFS, producing a fresh `content_hash`. Nothing is deleted — the edit is an append, not an overwrite of history.

---

## Database Model

Table: `gists`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Internal primary key |
| `gist_id` | `bigint` UNIQUE | On-chain ID from GistRegistry contract |
| `location_cell` | `text` | Coarse geohash cell |
| `location` | `geography(Point, 4326)` | PostGIS point for geo queries |
| `lat` | `float8` | Stored for convenience |
| `lon` | `float8` | Stored for convenience |
| `content_cid` | `text` | IPFS CID |
| `text` | `text` | Full gist text (cached from IPFS) |
| `author_address` | `text` | Nullable — anonymous posts allowed |
| `tx_hash` | `text` | Stellar transaction hash |
| `created_at` | `timestamptz` | |
| `previous_cid` | `text` | Nullable — IPFS CID this gist replaced, set on edit |
| `edited_at` | `timestamptz` | Nullable — set on edit |

### Idempotency ledger (`gist_write_attempts`)

A separate table, one row per logical post attempt, keyed by `idempotency_key` (unique). It carries the write-path state machine:

| Column | Type | Notes |
|---|---|---|
| `idempotency_key` | `varchar(255)` UNIQUE | Client header value, or a content-derived fallback |
| `request_hash` | `varchar(64)` | Detects key reuse with a different body (`422`) |
| `content_hash` | `varchar(100)` | IPFS CID pinned for this attempt |
| `stellar_gist_id` / `tx_hash` | `varchar(80)` | Filled once the on-chain write completes (`chained`) |
| `gist_id` | `uuid` | The persisted `gists.id`, set on `committed` |
| `status` | `varchar(16)` | `pending` → `chained` → `committed` |

`stellar_gist_id` is enforced unique on `gists` so the final insert and the indexer's `upsertFromEvent` both dedupe at the DB layer.

---

## Indexer

`src/indexer/indexer.service.ts` runs as a background NestJS worker. On startup it polls the Soroban RPC for new `GistRegistry` contract events and upserts each into Postgres. This keeps the DB in sync with on-chain state — gists posted directly on-chain still appear in query results.

---

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start with hot-reload |
| `npm run build` | Compile TypeScript |
| `npm run start:prod` | Run compiled output |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests |

---

## Contribution Guidelines

- Keep business logic in `services/`, keep controllers thin (validate + delegate only).
- Breaking API changes must be opened as an issue before implementation.
- All new behaviour should come with a unit or e2e test.

---

## License

[MIT](../LICENSE)
