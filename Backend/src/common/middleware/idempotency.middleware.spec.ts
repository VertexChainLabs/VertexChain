import * as express from 'express';
import * as request from 'supertest';
import { CacheService } from '../../cache/cache.service';
import { idempotencyMiddleware } from './idempotency.middleware';

function createMockCacheService(): jest.Mocked<CacheService> {
  return {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delPattern: jest.fn(),
    getMetrics: jest.fn(),
    resetMetrics: jest.fn(),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  } as unknown as jest.Mocked<CacheService>;
}

describe('Idempotency-Key middleware', () => {
  let app: express.Express;
  let cache: jest.Mocked<CacheService>;

  beforeEach(() => {
    cache = createMockCacheService();
    app = express();
    app.use(express.json());
    app.use(idempotencyMiddleware(cache));

    app.post('/gists', (req, res) => {
      res.status(200).json({ id: 'gist-123', content: req.body.content });
    });

    app.post('/gists/batch', (req, res) => {
      res.status(200).json({ count: req.body.length });
    });

    app.post('/flaky', (req, res) => {
      res.status(500).json({ error: 'boom' });
    });

    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok' });
    });
  });

  it('passes through when no Idempotency-Key header is present', async () => {
    cache.get.mockResolvedValue(null);

    const res = await request(app).post('/gists').send({ content: 'hello' }).expect(200);

    expect(res.body).toEqual({ id: 'gist-123', content: 'hello' });
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('passes through for GET requests regardless of header', async () => {
    const res = await request(app).get('/health').set('Idempotency-Key', 'key-1').expect(200);

    expect(res.body).toEqual({ status: 'ok' });
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('caches the first POST response and replays it on a second identical request', async () => {
    cache.get.mockResolvedValue(null);

    const res1 = await request(app)
      .post('/gists')
      .set('Idempotency-Key', 'key-1')
      .send({ content: 'hello' })
      .expect(200);

    expect(res1.body).toEqual({ id: 'gist-123', content: 'hello' });
    expect(cache.set).toHaveBeenCalledTimes(1);

    const setArgs = cache.set.mock.calls[0];
    expect(setArgs[0]).toBe('idemp:key-1');
    expect(setArgs[2]).toBe(86400);

    cache.get.mockResolvedValue(setArgs[1]);

    const res2 = await request(app)
      .post('/gists')
      .set('Idempotency-Key', 'key-1')
      .send({ content: 'hello' })
      .expect(200);

    expect(res2.body).toEqual({ id: 'gist-123', content: 'hello' });
    expect(res2.headers['idempotency-replayed']).toBe('true');
  });

  it('returns 422 when the same key is used with a different body', async () => {
    cache.get.mockResolvedValue(null);

    await request(app)
      .post('/gists')
      .set('Idempotency-Key', 'key-2')
      .send({ content: 'first' })
      .expect(200);

    const setArgs = cache.set.mock.calls[0];
    cache.get.mockResolvedValue(setArgs[1]);

    const res = await request(app)
      .post('/gists')
      .set('Idempotency-Key', 'key-2')
      .send({ content: 'different' })
      .expect(422);

    expect(res.body).toEqual({
      error: 'Idempotency-Key already used with a different request',
    });
  });

  it('returns 422 when the same key is used on a different path', async () => {
    cache.get.mockResolvedValue(null);

    await request(app)
      .post('/gists')
      .set('Idempotency-Key', 'key-3')
      .send({ content: 'hello' })
      .expect(200);

    const setArgs = cache.set.mock.calls[0];
    cache.get.mockResolvedValue(setArgs[1]);

    const res = await request(app)
      .post('/gists/batch')
      .set('Idempotency-Key', 'key-3')
      .send([{ content: 'hello' }])
      .expect(422);

    expect(res.body).toEqual({
      error: 'Idempotency-Key already used with a different request',
    });
  });

  it('uses configurable TTL', async () => {
    const origTtl = process.env.IDEMPOTENCY_TTL_SECONDS;
    process.env.IDEMPOTENCY_TTL_SECONDS = '3600';

    cache.get.mockResolvedValue(null);

    await request(app)
      .post('/gists')
      .set('Idempotency-Key', 'key-ttl')
      .send({ content: 'test' })
      .expect(200);

    expect(cache.set.mock.calls[0][2]).toBe(3600);

    process.env.IDEMPOTENCY_TTL_SECONDS = origTtl;
  });

  it('does not cache responses for requests without Idempotency-Key', async () => {
    cache.get.mockResolvedValue(null);

    await request(app).post('/gists').send({ content: 'no-key' }).expect(200);

    expect(cache.set).not.toHaveBeenCalled();
  });

  it('records a failed attempt when the handler responds with an error status', async () => {
    cache.get.mockResolvedValue(null);

    await request(app)
      .post('/flaky')
      .set('Idempotency-Key', 'key-fail')
      .send({ content: 'boom' })
      .expect(500);

    expect(cache.set).toHaveBeenCalledTimes(1);
    const setArgs = cache.set.mock.calls[0];
    expect(setArgs[0]).toBe('idemp:key-fail');
    expect(setArgs[1]).toMatchObject({ state: 'failed', status: 500, body: { error: 'boom' } });
  });

  it('allows a retry to proceed after a failed attempt instead of replaying the error', async () => {
    cache.get.mockResolvedValue(null);

    await request(app)
      .post('/flaky')
      .set('Idempotency-Key', 'key-fail')
      .send({ content: 'boom' })
      .expect(500);

    // The first attempt recorded a failed entry.
    const failedEntry = cache.set.mock.calls[0][1];
    expect(failedEntry).toMatchObject({ state: 'failed', status: 500 });

    // A retry of the same request reaches the handler again instead of
    // replaying the cached 500 or returning 422.
    cache.get.mockResolvedValue(failedEntry);
    const res = await request(app)
      .post('/flaky')
      .set('Idempotency-Key', 'key-fail')
      .send({ content: 'boom' })
      .expect(500);

    expect(res.headers['idempotency-replayed']).toBeUndefined();
    expect(cache.set).toHaveBeenCalledTimes(2);
  });
});
