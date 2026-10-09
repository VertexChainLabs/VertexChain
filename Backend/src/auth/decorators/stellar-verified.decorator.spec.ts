import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { StellarVerifiedUser } from './stellar-verified.decorator';
import { StellarVerified } from '../interfaces/stellar-verified.interface';

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the factory function registered by a @createParamDecorator() and
 * invoke it with a fake ExecutionContext, following the pattern used by
 * stellar-auth.guard.spec.ts in this repo.
 */
function callDecoratorFactory(
  stellarVerified: StellarVerified | undefined,
): StellarVerified | null {
  // Apply the decorator to a dummy class method so we can retrieve its metadata
  class Dummy {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    test(@StellarVerifiedUser() _user: StellarVerified | null) {}
  }

  const args: Record<
    string,
    { factory: (data: unknown, ctx: ExecutionContext) => StellarVerified | null }
  > = Reflect.getMetadata(ROUTE_ARGS_METADATA, Dummy, 'test') as typeof args;

  // There should be exactly one registered param decorator; grab its factory
  const [meta] = Object.values(args);
  const factory = meta.factory;

  const request = { stellarVerified };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return factory(undefined, ctx);
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('StellarVerifiedUser decorator', () => {
  it('returns the stellarVerified object when it is present on the request', () => {
    const verified: StellarVerified = {
      address: 'GABC1234',
      verifiedAt: new Date('2024-01-01T00:00:00.000Z'),
    };

    const result = callDecoratorFactory(verified);

    expect(result).toEqual(verified);
  });

  it('returns null when stellarVerified is absent from the request', () => {
    const result = callDecoratorFactory(undefined);
    expect(result).toBeNull();
  });

  it('returns null rather than undefined', () => {
    const result = callDecoratorFactory(undefined);
    expect(result).not.toBeUndefined();
    expect(result).toBeNull();
  });

  it('passes through the exact reference set on the request (no cloning)', () => {
    const verified: StellarVerified = {
      address: 'GDEF5678',
      verifiedAt: new Date(),
    };

    const result = callDecoratorFactory(verified);

    expect(result).toBe(verified); // same reference
  });
});
