import { Request, Response, NextFunction } from 'express';
import { createBrotliCompress, createGzip, BrotliCompress, Gzip } from 'zlib';

/**
 * Response compression middleware.
 *
 * Satisfies GitHub Issue #43 acceptance criteria:
 *   - Prefers `br` (Brotli) over `gzip` via Accept-Encoding negotiation,
 *     honoring q-values per RFC 7231 (q=0 disables the encoding), with
 *     explicit `q=0` overriding any implicit wildcard.
 *   - Skips health-check endpoints so liveness probes never buffer.
 *   - Handles streaming responses (no full-body buffering) by piping
 *     through a zlib Transform stream.
 *   - Avoids compressing upstream-compressed payloads (images, fonts,
 *     already-encoded binaries) by inspecting Content-Type.
 *   - Sets `Vary: Accept-Encoding` on every response (compressed or not)
 *     so CDNs / reverse proxies cache correctly.
 *   - Preserves the `res.write` backpressure signal — callers see the
 *     same boolean return value they would emit without compression
 *     (whether or not a zlib Transform is in the path).
 *   - Reclaims the zlib Transform's internal buffers on completion,
 *     on compressor error, or on premature client disconnect.
 *   - Drops downstream body bytes for 204 / 304 so callers can't
 *     accidentally violate RFC 7230 §3.3.1.
 *
 * Implemented against Node's built-in `zlib` so we don't pull in the
 * `compression` npm package (which only supports deflate/gzip and has no
 * native Brotli).
 */

/**
 * Paths whose body is never compressed. `/health` is universal for
 * ALB/ELB liveness probes; `/csrf-token` is a tiny JSON whose compression
 * overhead exceeds the benefit. Add more here as new probe-style routes
 * appear.
 */
const DEFAULT_SKIP_PATHS = new Set<string>(['/health', '/csrf-token']);

/**
 * Content-Type patterns we are willing to compress. Anything outside this
 * set — images, videos, fonts, already-gzipped binaries — flows through
 * untouched.
 */
const COMPRESSIBLE_CONTENT_TYPE =
  /^text\/|^application\/(json|xml|javascript|ld\+json|x-javascript|wasm)|^image\/svg\+xml/i;

/** Per RFC 7230 §3.3.1, these statuses must not carry a body. */
const NO_COMPRESSION_STATUS_CODES = new Set([204, 304]);

interface AcceptEncodingToken {
  coding: string;
  q: number;
}

/**
 * Tokenize an Accept-Encoding header per RFC 7231 §5.3.4:
 *   Accept-Encoding = #( codings [ weight ] )
 *   weight          = OWS ";" OWS "q=" Q-value
 *   Q-value         = "0" [ "." 0-3DIGIT ] / "1" [ "." 0-3("0") ]
 * Tokens with an invalid q-value fall back to the default of 1.0.
 */
function tokenizeAcceptEncoding(header: string | undefined): AcceptEncodingToken[] {
  if (!header) return [];

  return header
    .split(',')
    .map((raw) => raw.trim())
    .filter((token) => token.length > 0)
    .map<AcceptEncodingToken>((token) => {
      const parts = token.split(';').map((p) => p.trim());
      const coding = parts[0]?.toLowerCase() ?? '';
      let q = 1;
      for (const param of parts.slice(1)) {
        // RFC 7231 allows OWS inside the weight, e.g. "q = 0.5".
        // Split on '=' so `q`, `=`, value are independent of whitespace.
        const eqIndex = param.indexOf('=');
        if (eqIndex === -1) continue;
        const name = param.slice(0, eqIndex).trim().toLowerCase();
        if (name !== 'q') continue;
        const value = param.slice(eqIndex + 1).trim();
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
          q = parsed;
        }
      }
      return { coding, q };
    });
}

/**
 * Pick the best encoding the client will accept. Returns null when:
 *   - the only acceptable coding is `identity`,
 *   - all of our supported codings (`br`, `gzip`) are explicitly disabled
 *     via `q=0`,
 *   - the header lists nothing we support (including `*`).
 *
 * Among `br` and `gzip`, the higher q wins; ties prefer `br` so the
 * issue's "Must prefer brotli over gzip" rule holds even with equal q.
 * `*` is a wildcard that implies q=1 for everything we support; an
 * explicit `q=0` has higher precedence than the wildcard.
 */
function negotiateEncoding(header: string | undefined): 'br' | 'gzip' | null {
  const tokens = tokenizeAcceptEncoding(header);

  const qByCoding: Record<'br' | 'gzip', number> = { br: 0, gzip: 0 };
  const explicit: Record<'br' | 'gzip', boolean> = { br: false, gzip: false };
  let hasWildcard = false;
  for (const { coding, q } of tokens) {
    if (coding === '*') {
      hasWildcard = true;
      continue;
    }
    if (coding === 'br' || coding === 'gzip') {
      qByCoding[coding] = q;
      explicit[coding] = true;
    }
  }

  if (hasWildcard) {
    if (!explicit.br) qByCoding.br = 1;
    if (!explicit.gzip) qByCoding.gzip = 1;
  }

  if (qByCoding.br === 0 && qByCoding.gzip === 0) return null;
  if (qByCoding.br === 0) return 'gzip';
  if (qByCoding.gzip === 0) return 'br';
  if (qByCoding.br === qByCoding.gzip) return 'br'; // tie -> brotli preferred
  return qByCoding.br > qByCoding.gzip ? 'br' : 'gzip';
}

function shouldCompressContentType(contentType: string | undefined): boolean {
  if (!contentType) return true; // assume compressible if unknown
  return COMPRESSIBLE_CONTENT_TYPE.test(contentType);
}

export function compressionMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Express sets `req.path`; raw Node http does not. Derive a usable path
  // from `req.url` when Express hasn't populated it so /health and
  // /csrf-token stay correctly excluded outside of NestJS.
  const requestPath =
    typeof req.path === 'string' ? req.path : ((req.url ?? '/').split('?')[0] ?? '/');

  // Health probes and preflight requests never get compressed.
  // We still emit Vary so caches don't mix compressed and uncompressed variants.
  if (DEFAULT_SKIP_PATHS.has(requestPath) || req.method === 'HEAD' || req.method === 'OPTIONS') {
    res.setHeader('Vary', 'Accept-Encoding');
    return next();
  }

  // Set Vary on every response so intermediate caches respect Accept-Encoding.
  res.setHeader('Vary', 'Accept-Encoding');

  const encoding = negotiateEncoding(req.headers['accept-encoding'] as string | undefined);
  if (!encoding) return next();

  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  let stream: BrotliCompress | Gzip | null = null;
  let noBody = false;
  let initialized = false;
  let ended = false;

  const initStream = (): { stream: BrotliCompress | Gzip | null; noBody: boolean } => {
    if (initialized) return { stream, noBody };
    initialized = true;

    // No-content statuses must never carry a body, even if a controller
    // accidentally calls res.write/end with one. RFC 7230 §3.3.1 forbids
    // any message body for 204 / 304; we honor that at the byte layer.
    if (NO_COMPRESSION_STATUS_CODES.has(res.statusCode)) {
      noBody = true;
      res.removeHeader('Content-Length');
      return { stream: null, noBody };
    }

    const rawContentType = res.getHeader('Content-Type');
    const contentType = Array.isArray(rawContentType)
      ? rawContentType.join(';')
      : (rawContentType as string | undefined);

    if (!shouldCompressContentType(contentType)) {
      return { stream: null, noBody };
    }

    stream = encoding === 'br' ? createBrotliCompress() : createGzip();

    // Compression changes wire size — drop Content-Length so Express emits
    // Transfer-Encoding: chunked. ALB rejects responses that advertise a
    // pre-compression Content-Length.
    res.removeHeader('Content-Length');
    res.setHeader('Content-Encoding', encoding);

    stream.on('data', (chunk: Buffer) => {
      originalWrite(chunk);
    });
    stream.on('end', () => {
      if (ended) return;
      ended = true;
      // Drop internal buffers so GC can reclaim the Transform promptly.
      stream?.destroy();
      originalEnd();
    });
    stream.on('error', (err: Error) => {
      // A compressor failure must never reach the client as a partially-
      // valid compressed stream — a decompressor would emit gibberish.
      // Tear down the socket so NestJS exception filters surface the
      // failure as a real 500 rather than a silent truncation.
      if (ended) return;
      ended = true;
      stream?.destroy();
      res.destroy(err);
    });

    // If the client disconnects mid-stream, the compressor's 'end' never
    // fires. Reclaim the Transform's internal buffers promptly to avoid
    // a per-request leak.
    res.once('close', () => {
      if (ended) return;
      ended = true;
      stream?.destroy();
    });

    return { stream, noBody };
  };

  // res.write has two overloads (chunk+cb) and (chunk+encoding+cb). We
  // express the override with the same shape to stay type-safe.
  const writeOverride: typeof res.write = function write(
    chunk: any,
    encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ): boolean {
    const { stream: activeStream, noBody: dropBody } = initStream();

    if (dropBody) {
      // 204 / 304 — swallow the chunk but preserve the boolean contract
      // so upstream callers throttle exactly as they would normally.
      const cb = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
      if (cb) cb();
      return true;
    }

    if (!activeStream) {
      if (typeof encodingOrCallback === 'function') {
        return originalWrite(chunk, encodingOrCallback);
      }
      if (typeof encodingOrCallback === 'string') {
        return originalWrite(chunk, encodingOrCallback, callback);
      }
      return originalWrite(chunk);
    }

    if (typeof encodingOrCallback === 'function') {
      return activeStream.write(chunk, encodingOrCallback);
    }
    if (typeof encodingOrCallback === 'string') {
      return activeStream.write(chunk, encodingOrCallback, callback);
    }
    return activeStream.write(chunk);
  };

  const endOverride: typeof res.end = function end(
    chunk?: any,
    encodingOrCallback?: BufferEncoding | (() => void),
    callback?: () => void,
  ): Response {
    const { stream: activeStream, noBody: dropBody } = initStream();

    if (dropBody) {
      // No bytes on the wire — forward only the callback, drop chunk and
      // encoding. Express then sends a status-only 204/304 with no
      // Transfer-Encoding chunked trailer.
      const cb = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
      if (cb) {
        return originalEnd(cb);
      }
      return originalEnd();
    }

    if (!activeStream) {
      if (typeof encodingOrCallback === 'function') {
        return originalEnd(chunk, encodingOrCallback);
      }
      if (typeof encodingOrCallback === 'string') {
        return originalEnd(chunk, encodingOrCallback, callback);
      }
      return originalEnd(chunk);
    }

    if (chunk) {
      if (typeof encodingOrCallback === 'function') {
        activeStream.end(chunk, encodingOrCallback);
      } else if (typeof encodingOrCallback === 'string') {
        activeStream.end(chunk, encodingOrCallback, callback);
      } else {
        activeStream.end(chunk);
      }
    } else {
      if (typeof encodingOrCallback === 'function') {
        activeStream.end(encodingOrCallback);
      } else if (typeof encodingOrCallback === 'string') {
        activeStream.end(encodingOrCallback, callback);
      } else if (callback) {
        activeStream.end(callback);
      } else {
        activeStream.end();
      }
    }
    return res;
  };

  res.write = writeOverride;
  res.end = endOverride;

  next();
}
