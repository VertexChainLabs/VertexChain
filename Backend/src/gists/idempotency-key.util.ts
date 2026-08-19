import { createHash } from 'crypto';

/**
 * Deterministic fingerprint of a gist create request.
 *
 * Stable across retries of the same logical post, so the write path can
 * recognize a replay even when the client omits an `Idempotency-Key` header.
 * The payload is canonicalized (author normalized to `null`) before hashing so
 * two retries of the same anonymous post produce the same value.
 */
export function computeGistRequestHash(payload: {
  content: string;
  lat: number;
  lon: number;
  author?: string | null;
}): string {
  const canonical = JSON.stringify({
    content: payload.content,
    lat: payload.lat,
    lon: payload.lon,
    author: payload.author ?? null,
  });

  return createHash('sha256').update(canonical).digest('hex');
}
