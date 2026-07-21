# Cache-Control Headers Implementation

## Overview

This implementation adds CDN-friendly cache-control headers to the GET endpoints of the gists API, enabling downstream CDN services (Fastly, Vercel, Cloudflare) to cache responses and purge them when content changes.

## What Was Implemented

### 1. Cache-Control Interceptor (`src/common/interceptors/cache-control.interceptor.ts`)

Created three interceptor classes:
- **BaseCacheControlInterceptor**: Abstract base class that sets Cache-Control and Cache-Tag headers
- **NearbyCacheControlInterceptor**: For GET /gists (nearby search queries)
- **GistIdCacheControlInterceptor**: For GET /gists/:id (single gist retrieval)

**Headers set:**
- `Cache-Control: s-maxage=60, stale-while-revalidate=120`
  - CDNs can cache for 60 seconds
  - Stale content can be served for an additional 120 seconds while revalidating
- `Cache-Tag: gist:nearby:{cell}` (for nearby queries, where {cell} is the geohash)
- `Cache-Tag: gist:one:{id}` (for single gist queries)

### 2. Updated Gists Controller (`src/gists/gists.controller.ts`)

Added interceptors to GET endpoints:
- `GET /gists` → Uses `NearbyCacheControlInterceptor`
- `GET /gists/:id` → Uses `GistIdCacheControlInterceptor`

POST endpoints remain unchanged (no caching).

### 3. CDN Purge Support (`src/cache/cache.service.ts`)

Added `purgeCdnTags()` method to CacheService that:
- Sends purge requests to CDN providers when content changes
- Supports Fastly (Fastly-Key header), Vercel, and Cloudflare (Bearer token)
- Gracefully degrades if CDN configuration is not present

### 4. Updated Gists Service (`src/gists/gists.service.ts`)

Modified `invalidateNearbyCache()` to:
- Clear Redis cache (existing behavior)
- Purge CDN cache tags when a new gist is posted

### 5. Updated Module (`src/gists/gists.module.ts`)

Registered the interceptors as providers so they can be dependency-injected.

### 6. Environment Configuration (`Backend/.env.example`)

Added two new optional environment variables:
- `CDN_PURGE_ENDPOINT`: CDN API endpoint for cache purging
- `CDN_PURGE_TOKEN`: API token/key for authentication

## How It Works

### Caching Flow

1. **First request**: `GET /gists?lat=9.0579&lon=7.4951`
   - Backend processes request
   - Response includes: `Cache-Control: s-maxage=60, stale-while-revalidate=120`
   - Response includes: `Cache-Tag: gist:nearby:s0mc8dy` (geohash for the location)
   - CDN caches response for 60 seconds

2. **Subsequent requests** (within 60s): Served directly from CDN

3. **New gist posted** at the same location:
   - Backend creates gist
   - Backend calls `invalidateNearbyCache(lat, lon)`
   - Computes geohash: `s0mc8dy`
   - Sends purge request to CDN: `{"tags": ["gist:nearby:s0mc8dy"]}`
   - CDN invalidates cached responses with that tag
   - Next request gets fresh data

### Cache Tag Strategy

**Nearby queries** use geohash-based tags:
- Query at (9.0579, 7.4951) → geohash `s0mc8dy` → tag `gist:nearby:s0mc8dy`
- All queries in the same geohash cell share the same cache
- Posting a gist purges all cached responses for that cell

**Single gist queries** use ID-based tags:
- Query for gist `abc123` → tag `gist:one:abc123`
- Isolated caching per gist

## Configuration

### Without CDN (Local Development)

No additional configuration needed. Cache-Control headers are still emitted but won't have any effect without a CDN in front.

### With Fastly

```bash
CDN_PURGE_ENDPOINT=https://api.fastly.com/service/{service_id}/purge
CDN_PURGE_TOKEN=your_fastly_api_token
```

### With Vercel

```bash
CDN_PURGE_ENDPOINT=https://api.vercel.com/v1/purge
CDN_PURGE_TOKEN=your_vercel_api_token
```

### With Cloudflare

```bash
CDN_PURGE_ENDPOINT=https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache
CDN_PURGE_TOKEN=your_cloudflare_api_token
```

## Testing

### Verify Headers are Present

```bash
curl -I "http://localhost:3000/gists?lat=9.0579&lon=7.4951"
```

Expected headers:
```
Cache-Control: s-maxage=60, stale-while-revalidate=120
Cache-Tag: gist:nearby:s0mc8dy
```

### Test CDN Purge Flow

1. Configure CDN environment variables
2. Post a new gist:
   ```bash
   curl -X POST http://localhost:3000/gists \
     -H "Content-Type: application/json" \
     -d '{"lat":9.0579,"lon":7.4951,"content":"Test gist","author":"user1"}'
   ```
3. Check backend logs for: `Successfully purged CDN cache tags: gist:nearby:s0mc8dy`
4. If no CDN configured, logs show: `CDN_PURGE_ENDPOINT or CDN_PURGE_TOKEN not configured, skipping CDN purge`

## Acceptance Criteria ✅

- [x] Response bears both `Cache-Control` and `Cache-Tag` headers
- [x] Post a new gist → purge the tag → CDNs revalidate
- [x] Implemented in `Backend/src/gists/gists.controller.ts`
- [x] Created `Backend/src/common/interceptors/cache-control.interceptor.ts`

## Performance Impact

**Before**: Every GET /gists query hits the backend (and possibly Redis)

**After**: 
- CDN serves cached responses for 60 seconds
- Stale responses can be served for up to 180 seconds total
- Backend only processes requests on cache miss or after purge
- Significant RPS reduction on backend during high traffic

## Notes

- Geohash precision is 7 characters (~153m x 153m cells)
- Cache tags are tied to geohash cells, not exact lat/lon
- Batch gist creation purges all affected geohash cells
- CDN purge is fire-and-forget (errors are logged but don't block creation)
- Redis cache invalidation still happens regardless of CDN configuration
