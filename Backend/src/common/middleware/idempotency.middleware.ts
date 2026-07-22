import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { CacheService } from '../../cache/cache.service';

interface CachedEntry {
  status: number;
  body: unknown;
  reqHash: string;
}

function hashRequest(method: string, path: string, body: unknown): string {
  return createHash('sha256')
    .update(`${method}:${path}:${JSON.stringify(body)}`)
    .digest('hex');
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

        res.setHeader('Idempotency-Replayed', 'true');
        res.status(cached.status).json(cached.body);
        return;
      }

      const originalJson = res.json.bind(res);
      res.json = function (body: unknown) {
        const ttl = parseInt(process.env.IDEMPOTENCY_TTL_SECONDS ?? '86400', 10);
        void cacheService.set(
          cacheKey,
          { status: res.statusCode, body, reqHash } satisfies CachedEntry,
          ttl,
        );
        return originalJson(body);
      };

      next();
    })();
  };
}
