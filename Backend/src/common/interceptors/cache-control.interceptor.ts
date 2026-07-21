import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { GeoService } from '../../geo/geo.service';

export interface CacheControlOptions {
  sMaxage?: number;
  staleWhileRevalidate?: number;
  cacheTagStrategy?: 'nearby' | 'gist-id';
}

/**
 * Base cache control interceptor that can be extended for specific use cases
 */
@Injectable()
export abstract class BaseCacheControlInterceptor implements NestInterceptor {
  constructor(
    private readonly options: CacheControlOptions,
    private readonly geoService?: GeoService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        // Set Cache-Control header
        const directives: string[] = [];

        if (this.options.sMaxage !== undefined) {
          directives.push(`s-maxage=${this.options.sMaxage}`);
        }

        if (this.options.staleWhileRevalidate !== undefined) {
          directives.push(`stale-while-revalidate=${this.options.staleWhileRevalidate}`);
        }

        if (directives.length > 0) {
          res.setHeader('Cache-Control', directives.join(', '));
        }

        // Set Cache-Tag header for CDN purging
        const tags = this.generateCacheTags(req);
        if (tags.length > 0) {
          res.setHeader('Cache-Tag', tags.join(', '));
        }
      }),
    );
  }

  private generateCacheTags(req: Request): string[] {
    if (!this.options.cacheTagStrategy) {
      return [];
    }

    if (this.options.cacheTagStrategy === 'nearby' && this.geoService) {
      const { lat, lon } = req.query as { lat?: string; lon?: string };
      if (lat && lon) {
        const cell = this.geoService.encode(Number(lat), Number(lon));
        return [`gist:nearby:${cell}`];
      }
    }

    if (this.options.cacheTagStrategy === 'gist-id') {
      const { id } = req.params as { id: string };
      if (id) {
        return [`gist:one:${id}`];
      }
    }

    return [];
  }
}

/**
 * Cache control interceptor for nearby gist queries
 */
@Injectable()
export class NearbyCacheControlInterceptor extends BaseCacheControlInterceptor {
  constructor(geoService: GeoService) {
    super(
      {
        sMaxage: 60,
        staleWhileRevalidate: 120,
        cacheTagStrategy: 'nearby',
      },
      geoService,
    );
  }
}

/**
 * Cache control interceptor for single gist queries
 */
@Injectable()
export class GistIdCacheControlInterceptor extends BaseCacheControlInterceptor {
  constructor() {
    super({
      sMaxage: 60,
      staleWhileRevalidate: 120,
      cacheTagStrategy: 'gist-id',
    });
  }
}
