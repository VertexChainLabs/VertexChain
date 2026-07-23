import { CircuitBreakerService } from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService();
  });

  describe('getOrCreate', () => {
    it('should create a new circuit breaker', () => {
      const breaker = service.getOrCreate('test', async () => 'result');
      expect(breaker).toBeDefined();
      expect(breaker.name).toBe('test');
    });

    it('should return existing circuit breaker with same name', () => {
      const breaker1 = service.getOrCreate('test', async () => 'result');
      const breaker2 = service.getOrCreate('test', async () => 'other');
      expect(breaker1).toBe(breaker2);
    });
  });

  describe('getState', () => {
    it('should return not_initialized for unknown breakers', () => {
      expect(service.getState('unknown')).toBe('not_initialized');
    });

    it('should return closed for a new breaker', () => {
      service.getOrCreate('test', async () => 'result');
      expect(service.getState('test')).toBe('closed');
    });
  });

  describe('getStates', () => {
    it('should return all breaker states', () => {
      service.getOrCreate('a', async () => 'result');
      service.getOrCreate('b', async () => 'result');
      const states = service.getStates();
      expect(states).toEqual({ a: 'closed', b: 'closed' });
    });
  });

  describe('fire', () => {
    it('should return the action result on success', async () => {
      const result = await service.fire('test', async () => 'success');
      expect(result).toBe('success');
    });

    it('should return null on action failure', async () => {
      const result = await service.fire('test', async () => {
        throw new Error('fail');
      });
      expect(result).toBeNull();
    });

    it('should use provided options', async () => {
      const result = await service.fire(
        'custom',
        async () => 'custom-result',
        { timeout: 5000, name: 'custom' },
      );
      expect(result).toBe('custom-result');
    });
  });
});
