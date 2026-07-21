import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');
      if (!redisUrl) {
        this.logger.warn('REDIS_URL not configured, caching disabled');
        return;
      }

      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error('Redis connection failed after retries, disabling cache');
            this.redis = null;
            return null;
          }
          return Math.min(times * 100, 3000);
        },
      });

      this.redis.on('error', (err) => {
        this.logger.error(`Redis error: ${err.message}`);
        this.redis = null;
      });

      this.redis.on('connect', () => {
        this.logger.log('Redis connected successfully');
      });

      await this.redis.ping();
    } catch (error) {
      this.logger.error(`Failed to initialize Redis: ${error.message}`);
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  private isAvailable(): boolean {
    return this.redis !== null;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      this.cacheMisses++;
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (value === null) {
        this.cacheMisses++;
        return null;
      }

      this.cacheHits++;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}: ${error.message}`);
      this.cacheMisses++;
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttlSeconds, serialized);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}: ${error.message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}: ${error.message}`);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.error(`Cache delete pattern error for ${pattern}: ${error.message}`);
    }
  }

  getMetrics(): { hits: number; misses: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  resetMetrics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Purge CDN cache by sending cache-tag purge requests.
   * This method supports Fastly, Vercel, and Cloudflare.
   * Configure CDN_PURGE_ENDPOINT and CDN_PURGE_TOKEN in .env
   */
  async purgeCdnTags(tags: string[]): Promise<void> {
    if (tags.length === 0) {
      return;
    }

    const cdnPurgeEndpoint = this.configService.get<string>('CDN_PURGE_ENDPOINT');
    const cdnPurgeToken = this.configService.get<string>('CDN_PURGE_TOKEN');

    if (!cdnPurgeEndpoint || !cdnPurgeToken) {
      this.logger.debug(
        'CDN_PURGE_ENDPOINT or CDN_PURGE_TOKEN not configured, skipping CDN purge',
      );
      return;
    }

    try {
      // Support for different CDN providers
      // Fastly: POST to purge endpoint with Fastly-Key header
      // Vercel: POST to purge endpoint with Bearer token
      // Cloudflare: POST to purge endpoint with Bearer token
      const response = await fetch(cdnPurgeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Support both Fastly-Key and Authorization headers
          ...(cdnPurgeEndpoint.includes('fastly.com')
            ? { 'Fastly-Key': cdnPurgeToken }
            : { Authorization: `Bearer ${cdnPurgeToken}` }),
        },
        body: JSON.stringify({
          tags,
          // Some CDNs expect different field names
          surrogate_keys: tags, // Fastly
          cacheTags: tags, // Vercel/Cloudflare
        }),
      });

      if (!response.ok) {
        this.logger.error(
          `CDN purge failed with status ${response.status}: ${await response.text()}`,
        );
      } else {
        this.logger.log(`Successfully purged CDN cache tags: ${tags.join(', ')}`);
      }
    } catch (error) {
      this.logger.error(`CDN purge error: ${error.message}`);
    }
  }
}
