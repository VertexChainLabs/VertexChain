import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import CircuitBreaker = require('opossum');

export interface BreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  name?: string;
}

export type BreakerAction<T> = () => Promise<T>;

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreaker>();

  getOrCreate<T>(name: string, action: BreakerAction<T>, options?: BreakerOptions): CircuitBreaker {
    const existing = this.breakers.get(name);
    if (existing) return existing;

    const breaker = new CircuitBreaker(action, {
      timeout: options?.timeout ?? 3000,
      errorThresholdPercentage: options?.errorThresholdPercentage ?? 50,
      resetTimeout: options?.resetTimeout ?? 30000,
      name,
      volumeThreshold: 3,
    });

    breaker.on('open', () => this.logger.warn(`Circuit breaker "${name}" opened — degraded mode`));
    breaker.on('halfOpen', () => this.logger.log(`Circuit breaker "${name}" half-open — probing`));
    breaker.on('close', () =>
      this.logger.log(`Circuit breaker "${name}" closed — normal operation`),
    );

    this.breakers.set(name, breaker);
    return breaker;
  }

  getState(name: string): string {
    const breaker = this.breakers.get(name);
    if (!breaker) return 'not_initialized';
    if (breaker.opened) return 'open';
    if (breaker.halfOpen) return 'half_open';
    return 'closed';
  }

  getStates(): Record<string, string> {
    const states: Record<string, string> = {};
    for (const [name] of this.breakers) {
      states[name] = this.getState(name);
    }
    return states;
  }

  async fire<T>(
    name: string,
    action: BreakerAction<T>,
    options?: BreakerOptions,
  ): Promise<T | null> {
    const breaker = this.getOrCreate(name, action, options);

    try {
      return await breaker.fire();
    } catch {
      this.logger.warn(`Circuit breaker "${name}": action failed, falling back`);
      return null;
    }
  }
}
