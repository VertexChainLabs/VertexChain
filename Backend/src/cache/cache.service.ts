import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CircuitBreakerService } from '../common/circuit/circuit-breaker.service';

const DEFAULT_REPLICA_CHECK_INTERVAL = 30_000;

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private replicaClient: Redis | null = null;
  private cacheHits = 0;
  private cacheMisses = 0;
  private replicaCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const sentinelUrls = this.configService.get<string>('REDIS_SENTINEL_URLS');

    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured, caching disabled');
      return;
    }

    try {
      if (sentinelUrls) {
        this.redis = this.createSentinelClient(redisUrl, sentinelUrls);
      } else {
        this.redis = this.createStandardClient(redisUrl);
      }

      this.setupClientListeners(this.redis, 'primary');
      await this.redis.ping();
      this.logger.log('Redis primary connected successfully');

      const replicaUrl = this.configService.get<string>('REDIS_REPLICA_URL');
      if (replicaUrl) {
        this.replicaClient = new Redis(replicaUrl, {
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
          enableReadyCheck: false,
        });
        this.setupClientListeners(this.replicaClient, 'replica');
        this.logger.log('Redis read-replica configured');
      }
    } catch (error) {
      this.logger.error(`Failed to initialize Redis: ${error.message}`);
      this.redis = null;
    }

    this.startReplicaHealthCheck();
  }

  async onModuleDestroy() {
    if (this.replicaCheckTimer) {
      clearInterval(this.replicaCheckTimer);
      this.replicaCheckTimer = null;
    }
    await this.quitClient(this.redis);
    await this.quitClient(this.replicaClient);
  }

  private createStandardClient(url: string): Redis {
    return new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 5) {
          this.logger.error('Redis connection failed after retries, disabling');
          return null;
        }
        return Math.min(times * 200, 3000);
      },
      enableReadyCheck: true,
      lazyConnect: false,
    });
  }

  private createSentinelClient(name: string, sentinelUrls: string): Redis {
    const urls = sentinelUrls.split(',').map((s) => s.trim()).filter(Boolean);
    const sentinels = urls.map((url) => {
      const parsed = new URL(url);
      return { host: parsed.hostname, port: Number(parsed.port || 26379) };
    });

    return new Redis({
      name,
      sentinels,
      role: 'master',
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 5) return null;
        return Math.min(times * 200, 3000);
      },
      enableReadyCheck: true,
    });
  }

  private setupClientListeners(client: Redis, label: string): void {
    client.on('error', (err) => {
      this.logger.error(`Redis ${label} error: ${err.message}`);
    });
    client.on('connect', () => {
      this.logger.log(`Redis ${label} connected`);
    });
    client.on('close', () => {
      this.logger.warn(`Redis ${label} connection closed`);
    });
    client.on('reconnecting', () => {
      this.logger.warn(`Redis ${label} reconnecting`);
    });
  }

  private startReplicaHealthCheck(): void {
    const interval = this.configService.get<number>(
      'REDIS_REPLICA_CHECK_INTERVAL_MS',
      DEFAULT_REPLICA_CHECK_INTERVAL,
    );

    this.replicaCheckTimer = setInterval(async () => {
      try {
        if (this.replicaClient) {
          await this.replicaClient.ping();
        }
      } catch {
        this.logger.warn('Redis replica health check failed, attempting rebuild');
        await this.rebuildReplicaClient();
      }
    }, interval);
  }

  private async rebuildReplicaClient(): Promise<void> {
    try {
      await this.quitClient(this.replicaClient);
      const replicaUrl = this.configService.get<string>('REDIS_REPLICA_URL');
      if (replicaUrl) {
        this.replicaClient = new Redis(replicaUrl, {
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
          enableReadyCheck: false,
        });
        this.setupClientListeners(this.replicaClient, 'replica');
        this.logger.log('Redis read-replica rebuilt successfully');
      }
    } catch (error) {
      this.logger.error(`Failed to rebuild Redis replica: ${error.message}`);
    }
  }

  private async quitClient(client: Redis | null): Promise<void> {
    if (client) {
      try {
        client.removeAllListeners();
        await client.quit();
      } catch {
        client.disconnect();
      }
    }
  }

  private isAvailable(): boolean {
    return this.redis !== null;
  }

  private getReadClient(): Redis | null {
    return this.replicaClient ?? this.redis;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      this.cacheMisses++;
      return null;
    }

    const result = await this.circuitBreaker.fire<T | null>(
      'cache.get',
      async () => {
        const client = this.getReadClient();
        const value = await client!.get(key);
        return value !== null ? (JSON.parse(value) as T) : null;
      },
      { name: 'cache.get', timeout: 2000, errorThresholdPercentage: 50, resetTimeout: 10000 },
    );

    if (result === null) {
      this.cacheMisses++;
    } else {
      this.cacheHits++;
    }

    return result;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.isAvailable()) return;

    await this.circuitBreaker.fire(
      'cache.set',
      async () => {
        const serialized = JSON.stringify(value);
        await this.redis!.setex(key, ttlSeconds, serialized);
      },
      { name: 'cache.set', timeout: 2000, errorThresholdPercentage: 50, resetTimeout: 10000 },
    );
  }

  async del(key: string): Promise<void> {
    if (!this.isAvailable()) return;

    await this.circuitBreaker.fire(
      'cache.del',
      async () => {
        await this.redis!.del(key);
      },
      { name: 'cache.del', timeout: 2000, errorThresholdPercentage: 50, resetTimeout: 10000 },
    );
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.isAvailable()) return;

    await this.circuitBreaker.fire(
      'cache.delPattern',
      async () => {
        const keys = await this.redis!.keys(pattern);
        if (keys.length > 0) {
          await this.redis!.del(...keys);
        }
      },
      { name: 'cache.delPattern', timeout: 5000, errorThresholdPercentage: 50, resetTimeout: 10000 },
    );
  }

  getMetrics(): {
    hits: number;
    misses: number;
    hitRate: number;
    circuitStates: Record<string, string>;
    redisState: string;
  } {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: Math.round(hitRate * 100) / 100,
      circuitStates: this.circuitBreaker.getStates(),
      redisState: this.redis ? 'connected' : 'disconnected',
    };
  }

  resetMetrics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  getConnectionState(): string {
    return this.redis ? 'connected' : 'disconnected';
  }
}
