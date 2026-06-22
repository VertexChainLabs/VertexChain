import { Buffer } from 'buffer';
import { Request, Response } from 'express';
import { brotliDecompressSync, gunzipSync } from 'zlib';
import { compressionMiddleware } from './compression.middleware';

type MockResponse = Response & {
  getEmittedBody(): Promise<Buffer>;
};

/**
 * Build a plain JS-object mock of Express's Response. Avoids Node PassThrough
 * entirely so we have deterministic, synchronous-feeling byte capture.
 *
 * `res.write` / `res.end` chunk into a buffer. The mock's write is captured
 * by the middleware via `res.write.bind(res)` BEFORE the middleware replaces
 * `res.write` with its compressor override — so when the compressor calls
 * the *original* write, our buffer accumulates the wire payload.
 */
function buildResMock(contentType?: string): { res: MockResponse } {
  const chunks: Buffer[] = [];
  const headerBag: Record<string, string> = {};
  if (contentType) headerBag['content-type'] = contentType;

  let resolveBody!: (body: Buffer) => void;
  const bodyPromise = new Promise<Buffer>((resolve) => {
    resolveBody = resolve;
  });

  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader(name: string, value: string | number | string[]): void {
      headerBag[name.toLowerCase()] = String(value);
    },
    getHeader(name: string): string | number | string[] | undefined {
      return headerBag[name.toLowerCase()];
    },
    hasHeader(name: string): boolean {
      return name.toLowerCase() in headerBag;
    },
    removeHeader(name: string): void {
      delete headerBag[name.toLowerCase()];
    },
    write(
      chunk: Buffer | string | Uint8Array,
      encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void,
    ): boolean {
      const buf =
        typeof chunk === 'string'
          ? Buffer.from(chunk, typeof encodingOrCallback === 'string' ? encodingOrCallback : 'utf8')
          : Buffer.from(chunk instanceof Uint8Array ? chunk : Buffer.from(chunk));

      chunks.push(buf);

      const cb = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
      if (cb) cb();
      return true;
    },
    end(
      chunk?: Buffer | string | Uint8Array,
      encodingOrCallback?: BufferEncoding | (() => void),
      callback?: () => void,
    ): MockResponse {
      if (chunk) {
        const buf =
          typeof chunk === 'string'
            ? Buffer.from(
                chunk,
                typeof encodingOrCallback === 'string' ? encodingOrCallback : 'utf8',
              )
            : Buffer.from(chunk instanceof Uint8Array ? chunk : Buffer.from(chunk));
        chunks.push(buf);
      }

      resolveBody(Buffer.concat(chunks));
      resolveBody = undefined as unknown as (body: Buffer) => void;

      const cb = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
      if (cb) cb();
      return res;
    },
    once(_event: string, _listener: (...args: unknown[]) => void): void {
      // Stash the close listener so tests can drive unmount/disconnect
      // simulation without going through a real PassThrough.
      (res as { _closeListeners?: Array<() => void> })._closeListeners = (
        (res as { _closeListeners?: Array<() => void> })._closeListeners ?? []
      ).concat(() => _listener());
    },
    emit(event: string): boolean {
      if (event !== 'close') return false;
      const listeners = (res as { _closeListeners?: Array<() => void> })._closeListeners ?? [];
      for (const listener of listeners) listener();
      listeners.length = 0;
      return true;
    },
    getEmittedBody(): Promise<Buffer> {
      return bodyPromise;
    },
  } as unknown as MockResponse;

  return { res };
}

function buildReq(path: string, acceptEncoding?: string, method = 'GET'): Request {
  return {
    path,
    method,
    headers: acceptEncoding ? { 'accept-encoding': acceptEncoding } : {},
  } as unknown as Request;
}

describe('compressionMiddleware (unit)', () => {
  describe('path / method skips', () => {
    it('does not compress /health even when the client requests brotli', () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      compressionMiddleware(buildReq('/health', 'br, gzip'), res, next);
      expect(res.getHeader('Content-Encoding')).toBeUndefined();
      expect(res.getHeader('Vary')).toBe('Accept-Encoding');
      expect(next).toHaveBeenCalled();
    });

    it('does not compress /csrf-token', () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      compressionMiddleware(buildReq('/csrf-token', 'br, gzip'), res, next);
      expect(res.getHeader('Content-Encoding')).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('does not compress HEAD requests', () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      compressionMiddleware(buildReq('/gists', 'br, gzip', 'HEAD'), res, next);
      expect(res.getHeader('Content-Encoding')).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('does not compress OPTIONS requests', () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      compressionMiddleware(buildReq('/gists', 'br, gzip', 'OPTIONS'), res, next);
      expect(res.getHeader('Content-Encoding')).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('still emits Vary: Accept-Encoding for skipped routes (cache safety)', () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      compressionMiddleware(buildReq('/health', 'br, gzip'), res, next);
      expect(res.getHeader('Vary')).toBe('Accept-Encoding');
    });
  });

  describe('Accept-Encoding negotiation', () => {
    it('prefers brotli when both br and gzip are advertised', async () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      compressionMiddleware(buildReq('/gists', 'gzip, deflate, br'), res, next);

      const payload = { hello: 'world', items: [1, 2, 3] };
      res.end(JSON.stringify(payload));

      expect(res.getHeader('Content-Encoding')).toBe('br');

      const compressed = await res.getEmittedBody();
      expect(compressed.length).toBeGreaterThan(0);

      const decoded = brotliDecompressSync(compressed).toString('utf8');
      expect(JSON.parse(decoded)).toEqual(payload);
    });

    it('falls back to gzip when brotli is not advertised', async () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      compressionMiddleware(buildReq('/gists', 'gzip, deflate'), res, next);

      const payload = { hello: 'world', repeated: 'a'.repeat(200) };
      res.end(JSON.stringify(payload));

      expect(res.getHeader('Content-Encoding')).toBe('gzip');

      const compressed = await res.getEmittedBody();
      const decoded = gunzipSync(compressed).toString('utf8');
      expect(JSON.parse(decoded)).toEqual(payload);
    });

    it('emits no Content-Encoding when only identity is supported', async () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      compressionMiddleware(buildReq('/gists', 'identity'), res, next);

      res.end('{}');
      await res.getEmittedBody();

      expect(res.getHeader('Content-Encoding')).toBeUndefined();
      expect(res.getHeader('Vary')).toBe('Accept-Encoding');
    });

    it('emits no Content-Encoding when no Accept-Encoding header is sent', async () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      compressionMiddleware(buildReq('/gists'), res, next);

      res.end('{}');
      await res.getEmittedBody();

      expect(res.getHeader('Content-Encoding')).toBeUndefined();
      expect(res.getHeader('Vary')).toBe('Accept-Encoding');
    });

    it('picks gzip when q-values favor gzip over brotli', async () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      compressionMiddleware(buildReq('/gists', 'br;q=0.1, gzip;q=0.9'), res, next);

      res.end(JSON.stringify({ a: 'a'.repeat(50) }));
      await res.getEmittedBody();

      expect(res.getHeader('Content-Encoding')).toBe('gzip');
    });

    it('treats q=0 as disabled (selects br even when br is later in the header)', async () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      compressionMiddleware(buildReq('/gists', 'gzip;q=0, br'), res, next);

      res.end(JSON.stringify({ a: 'a'.repeat(50) }));
      await res.getEmittedBody();

      expect(res.getHeader('Content-Encoding')).toBe('br');
    });

    it('tolerates whitespace around q= (RFC 7231 OWS)', async () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      compressionMiddleware(buildReq('/gists', 'gzip; q = 0.1, br ;q=0.9 '), res, next);

      res.end(JSON.stringify({ a: 'a'.repeat(50) }));
      await res.getEmittedBody();

      expect(res.getHeader('Content-Encoding')).toBe('br');
    });

    it('falls back to brotli for the wildcard "*" when no explicit coding', () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      compressionMiddleware(buildReq('/gists', '*'), res, next);

      res.end('{}');

      expect(res.getHeader('Content-Encoding')).toBe('br');
    });

    it('does not compress anything when both br and gzip are disabled via q=0', async () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      compressionMiddleware(buildReq('/gists', 'br;q=0, gzip;q=0'), res, next);

      res.end('{}');
      await res.getEmittedBody();

      expect(res.getHeader('Content-Encoding')).toBeUndefined();
      expect(res.getHeader('Vary')).toBe('Accept-Encoding');
    });

    it('does not let the * wildcard override an explicit q=0 (RFC 7231)', async () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      // Client explicitly refuses br (q=0) but allows anything else via *.
      // Per RFC 7231, the explicit q=0 must stick for br, and the wildcard
      // applies gzip at implicit q=1 — so gzip wins.
      compressionMiddleware(buildReq('/gists', 'br;q=0, *'), res, next);

      res.end('{}');
      await res.getEmittedBody();

      expect(res.getHeader('Content-Encoding')).toBe('gzip');
    });
  });

  describe('Content-Type policy', () => {
    it('skips compression for image/png payloads', async () => {
      const next = jest.fn();
      const { res } = buildResMock('image/png');
      compressionMiddleware(buildReq('/gists', 'br, gzip'), res, next);

      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      res.end(pngBytes);

      await res.getEmittedBody();
      expect(res.getHeader('Content-Encoding')).toBeUndefined();
    });

    it('skips compression for 204 No Content', async () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      (res as { statusCode: number }).statusCode = 204;
      compressionMiddleware(buildReq('/gists', 'br, gzip'), res, next);

      // 204 must never carry a body — so even though we hand bytes in, the
      // middleware must short-circuit before the compressor starts.
      res.end();

      await res.getEmittedBody();
      expect(res.getHeader('Content-Encoding')).toBeUndefined();
    });

    it('drops body bytes for 204 No Content even if the controller writes them', async () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      (res as { statusCode: number }).statusCode = 204;
      compressionMiddleware(buildReq('/gists', 'br, gzip'), res, next);

      // Controller attempts to attach a body to the 204 — middleware must
      // drop the bytes (RFC 7230 §3.3.1) regardless of negotiation outcome.
      res.end('{"status":"ok"}');

      const emitted = await res.getEmittedBody();
      expect(emitted.length).toBe(0);
      expect(res.getHeader('Content-Encoding')).toBeUndefined();
      expect(res.getHeader('Content-Length')).toBeUndefined();
    });

    it('compresses text/html payloads with brotli', async () => {
      const next = jest.fn();
      const { res } = buildResMock('text/html; charset=utf-8');
      compressionMiddleware(buildReq('/gists', 'br, gzip'), res, next);

      const html = '<!doctype html>' + '<p>hello world</p>'.repeat(50);
      res.end(html);

      expect(res.getHeader('Content-Encoding')).toBe('br');

      const compressed = await res.getEmittedBody();
      const decoded = brotliDecompressSync(compressed).toString('utf8');
      expect(decoded).toContain('<!doctype html>');
      expect(decoded.length).toBe(html.length);
    });
  });

  describe('streaming fidelity', () => {
    it('streams multi-chunk bodies through the compressor without losing data', async () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      compressionMiddleware(buildReq('/gists', 'br'), res, next);

      const payload = { items: Array.from({ length: 50 }, (_, i) => ({ i })) };
      const text = JSON.stringify(payload);
      const head = text.slice(0, 30);
      const middle = text.slice(30, -2);
      const tail = text.slice(-2);

      res.write(head);
      res.write(middle);
      res.end(tail);

      expect(res.getHeader('Content-Encoding')).toBe('br');

      const compressed = await res.getEmittedBody();
      const decoded = brotliDecompressSync(compressed).toString('utf8');
      expect(JSON.parse(decoded)).toEqual(payload);
    });

    it('removes Content-Length when compressing', async () => {
      const next = jest.fn();
      const { res } = buildResMock('application/json');
      res.setHeader('Content-Length', '9999');
      compressionMiddleware(buildReq('/gists', 'gzip'), res, next);

      res.end(JSON.stringify({ a: 'a'.repeat(500) }));
      await res.getEmittedBody();

      // False pre-compression size must never reach ALB — drop it.
      expect(res.getHeader('Content-Length')).toBeUndefined();
      expect(res.getHeader('Content-Encoding')).toBe('gzip');
    });
  });

  describe('Reduce wire size', () => {
    it('produces a smaller wire body for repetitive JSON', async () => {
      const text = 'lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
      const payload = JSON.stringify({ body: text.repeat(200) });
      const raw = Buffer.from(payload, 'utf8');

      const { res: resGzip } = buildResMock('application/json');
      compressionMiddleware(buildReq('/gists', 'gzip'), resGzip, jest.fn());
      resGzip.end(payload);
      const gzipWire = await resGzip.getEmittedBody();

      expect(gzipWire.length).toBeLessThan(raw.length);
      expect(gzipWire.length).toBeLessThan(raw.length / 2);

      // And brotli should compress at least as well.
      const { res: resBr } = buildResMock('application/json');
      compressionMiddleware(buildReq('/gists', 'br'), resBr, jest.fn());
      resBr.end(payload);
      const brWire = await resBr.getEmittedBody();
      expect(brWire.length).toBeLessThan(raw.length);
    });
  });
});
