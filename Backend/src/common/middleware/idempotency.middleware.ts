import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { CacheService } from '../../cache/cache.service';

interface CachedEntry {
  // `state` is absent on entries written before this change; treat those as
  // completed (`done`) responses.
  state?: 'done' | 'failed';
  status: number;
  body: unknown;
  reqHash: string;
}

function hashRequest(method: string, path: string, body: unknown): string {
  return createHash('sha256')
    .update(`${method}:${path}:${JSON.stringify(body)}`)
    .digest('hex');
}

function replayCached(res: Response, status: number, body: unknown): void {
  res.setHeader('Idempotency-Replayed', 'true');
  res.status(status).json(body);
}

export function idempotencyMiddleware(cacheService: CacheService) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!['POST', 'PATCH', 'PUT'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) {
      return next();
    }

    const cacheKey = `idemp:${idempotencyKey}`;
    const reqHash = hashRequest(req.method, req.path, req.body);

    void (async () => {
      const cached = await cacheService.get<CachedEntry>(cacheKey);
      if (cached) {
        if (cached.reqHash !== reqHash) {
          res.status(422).json({
            error: 'Idempotency-Key already used with a different request',
          });
          return;
        }

        if (cached.state === 'failed') {
          // The previous attempt failed and never produced a completed
          // response. Allow the retry to proceed instead of replaying an error.
          armResponseRecording(cacheService, res, cacheKey, reqHash);
          next();
          return;
        }

        replayCached(res, cached.status, cached.body);
        return;
      }

      armResponseRecording(cacheService, res, cacheKey, reqHash);
      next();
    })();
  };
}

function armResponseRecording(
  cacheService: CacheService,
  res: Response,
  cacheKey: string,
  reqHash: string,
): void {
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    const ttl = parseInt(process.env.IDEMPOTENCY_TTL_SECONDS ?? '86400', 10);
    const entry: CachedEntry = {
      state: res.statusCode >= 400 ? 'failed' : 'done',
      status: res.statusCode,
      body,
      reqHash,
    };
    void cacheService.set(cacheKey, entry, ttl);
    return originalJson(body);
  };
}
