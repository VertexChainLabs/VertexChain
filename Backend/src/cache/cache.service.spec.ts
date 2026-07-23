import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { CircuitBreakerService } from '../common/circuit/circuit-breaker.service';

jest.setTimeout(30000);

describe('CacheService', () => {
  let service: CacheService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockCircuitBreaker: jest.Mocked<CircuitBreakerService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    mockCircuitBreaker = {
      fire: jest.fn(),
      getOrCreate: jest.fn(),
      getState: jest.fn().mockReturnValue('closed'),
      getStates: jest.fn().mockReturnValue({}),
    } as unknown as jest.Mocked<CircuitBreakerService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CircuitBreakerService,
          useValue: mockCircuitBreaker,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(async () => {
    if (service) {
      await service.onModuleDestroy();
    }
  });

  describe('onModuleInit', () => {
    it('should not initialize Redis when REDIS_URL is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      await service.onModuleInit();
    });


  });

  describe('get', () => {
    it('should return null when Redis is unavailable', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      await service.onModuleInit();

      const result = await service.get('test-key');
      expect(result).toBeNull();
    });

    it('should track cache misses when Redis is unavailable', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      await service.onModuleInit();

      await service.get('test-key');
      const metrics = service.getMetrics();

      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(1);
    });


  });

  describe('set', () => {
    it('should not attempt set when Redis is unavailable', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      await service.onModuleInit();

      await service.set('test-key', { data: 'test' }, 60);
    });
  });

  describe('del', () => {
    it('should not attempt delete when Redis is unavailable', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      await service.onModuleInit();

      await service.del('test-key');
    });
  });

  describe('delPattern', () => {
    it('should not attempt pattern delete when Redis is unavailable', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      await service.onModuleInit();

      await service.delPattern('gist:nearby:*');
    });
  });

  describe('getMetrics', () => {
    it('should return 0 hit rate when no requests', () => {
      const metrics = service.getMetrics();
      expect(metrics.hitRate).toBe(0);
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.circuitStates).toBeDefined();
      expect(metrics.redisState).toBeDefined();
    });
  });

  describe('resetMetrics', () => {
    it('should reset hit and miss counters', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      await service.onModuleInit();

      await service.get('test-key');
      service.resetMetrics();
      const metrics = service.getMetrics();

      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
    });
  });
});
