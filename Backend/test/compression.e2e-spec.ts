import * as http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import * as request from 'supertest';
import { brotliDecompressSync, gunzipSync } from 'zlib';
import { compressionMiddleware } from '../src/common/middleware/compression.middleware';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
type Routes = Record<string, Handler>;
type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

/**
 * Standalone HTTP-level integration tests for the compression middleware.
 *
 * Most assertions live in the supertest block. Because supertest's
 * underlying superagent auto-decompresses gzip/brotli streams before
 * calling our `.parse()` hook, we cannot manually decompress what supertest
 * already decompressed. Instead, those tests assert response headers only.
 *
 * The `raw http.get` block is used to fetch the un-decompressed wire
 * payload, so we can verify round-trip correctness and wire-size reduction.
 */
function buildApp(middleware: Middleware, routes: Routes): http.Server {
  return http.createServer((req, res) => {
    middleware(req, res, () => {
      const handler = routes[req.url ?? ''];
      if (!handler) {
        res.statusCode = 404;
        res.end();
        return;
      }
      handler(req, res);
    });
  });
}

function buildTestApp(): http.Server {
  const routes: Routes = {
    '/gists': (_req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          data: Array.from({ length: 100 }, (_, i) => ({
            id: `${i}`,
            content: 'sample content',
          })),
          pagination: { count: 100, hasMore: false },
        }),
      );
    },
    '/gists/large': (_req, res) => {
      const text = 'the quick brown fox jumps over the lazy dog. ';
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ body: text.repeat(500) }));
    },
    '/image.png': (_req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/png');
      res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    },
    '/health': (_req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok' }));
    },
  };
  return buildApp(compressionMiddleware, routes);
}

describe('Compression middleware (supertest, header-only)', () => {
  it('compresses JSON with brotli and chunked transfer when br is preferred', async () => {
    const res = await request(buildTestApp())
      .get('/gists/large')
      .set('Accept-Encoding', 'br, gzip')
      .expect(200);

    expect(res.headers['content-encoding']).toBe('br');
    expect(res.headers['vary']).toBe('Accept-Encoding');
    expect(res.headers['transfer-encoding']).toBe('chunked');
    expect(res.headers['content-length']).toBeUndefined();
  });

  it('compresses JSON with gzip when only gzip is advertised', async () => {
    const res = await request(buildTestApp())
      .get('/gists/large')
      .set('Accept-Encoding', 'gzip, deflate')
      .expect(200);

    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.headers['vary']).toBe('Accept-Encoding');
  });

  it('picks gzip when its q-value beats brotli', async () => {
    const res = await request(buildTestApp())
      .get('/gists/large')
      .set('Accept-Encoding', 'br;q=0.1, gzip;q=0.9')
      .expect(200);

    expect(res.headers['content-encoding']).toBe('gzip');
  });

  it('disables a coding via q=0 and picks the remaining one', async () => {
    const res = await request(buildTestApp())
      .get('/gists/large')
      .set('Accept-Encoding', 'gzip;q=0, br')
      .expect(200);

    expect(res.headers['content-encoding']).toBe('br');
  });

  it('does NOT compress the /health endpoint even with brotli accepted', async () => {
    const res = await request(buildTestApp())
      .get('/health')
      .set('Accept-Encoding', 'br, gzip')
      .expect(200);
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.headers['vary']).toBe('Accept-Encoding');
  });

  it('does NOT compress image responses', async () => {
    const res = await request(buildTestApp())
      .get('/image.png')
      .set('Accept-Encoding', 'br, gzip')
      .expect(200);
    expect(res.headers['content-encoding']).toBeUndefined();
  });
  it('still emits Vary: Accept-Encoding when only identity is advertised', async () => {
    const res = await request(buildTestApp())
      .get('/gists')
      .set('Accept-Encoding', 'identity')
      .expect(200);
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.headers['vary']).toBe('Accept-Encoding');
  });
});

describe('Compression middleware (raw http, round-trip + wire size)', () => {
  type FetchResult = {
    headers: http.IncomingHttpHeaders;
    body: Buffer;
  };

  function fetchRaw(acceptEncoding: string | null): Promise<FetchResult> {
    return new Promise((resolve, reject) => {
      const server = buildTestApp();
      server.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') {
          server.close();
          reject(new Error('Failed to bind test server'));
          return;
        }
        const headers: http.OutgoingHttpHeaders = {};
        if (acceptEncoding !== null) {
          headers['Accept-Encoding'] = acceptEncoding;
        }
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: addr.port,
            path: '/gists/large',
            method: 'GET',
            headers,
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => {
              server.close();
              resolve({ headers: res.headers, body: Buffer.concat(chunks) });
            });
            res.on('error', reject);
          },
        );
        req.on('error', reject);
        req.end();
      });
    });
  }

  it('round-trips a brotli body and matches the original payload', async () => {
    const res = await fetchRaw('br, gzip');
    expect(res.headers['content-encoding']).toBe('br');
    const decoded = brotliDecompressSync(res.body).toString('utf8');
    const json = JSON.parse(decoded) as { body: string };
    expect(json.body).toContain('the quick brown fox');
    expect(json.body.length).toBeGreaterThan(5000);
  });

  it('round-trips a gzip body and matches the original payload', async () => {
    const res = await fetchRaw('gzip, deflate');
    expect(res.headers['content-encoding']).toBe('gzip');
    const decoded = gunzipSync(res.body).toString('utf8');
    const json = JSON.parse(decoded) as { body: string };
    expect(json.body).toContain('the quick brown fox');
  });

  it('reduces wire size for highly compressible payloads', async () => {
    const uncompressed = await fetchRaw('identity');
    const compressed = await fetchRaw('gzip, deflate');

    expect(compressed.body.length).toBeLessThan(uncompressed.body.length);
    expect(compressed.body.length / uncompressed.body.length).toBeLessThan(0.5);
  });

  it('is graceful when no Accept-Encoding is sent at all', async () => {
    const res = await fetchRaw(null);
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.headers['vary']).toBe('Accept-Encoding');
    expect(res.body.length).toBeGreaterThan(5000);
  });
});
