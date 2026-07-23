import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StellarAuthGuard } from './stellar-auth.guard';
import { StrKey } from '@stellar/stellar-sdk';
import { verifyAsync } from '@noble/ed25519';

jest.mock('@stellar/stellar-sdk', () => ({
  StrKey: {
    decodeEd25519PublicKey: jest.fn(),
  },
}));

jest.mock('@noble/ed25519', () => ({
  verifyAsync: jest.fn(),
}));

function mockExecutionContext(headers: Record<string, string>, body: unknown) {
  const request: Record<string, unknown> = { headers, body };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}

describe('StellarAuthGuard', () => {
  let guard: StellarAuthGuard;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    configService = { get: jest.fn().mockReturnValue(300) } as any;
    guard = new StellarAuthGuard(configService);
    jest.clearAllMocks();
  });

  describe('anonymous access', () => {
    it('should allow requests without any X-Stellar-* headers', async () => {
      const context = mockExecutionContext({}, { content: 'hello', lat: 0, lon: 0 });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should set stellarVerified to null on anonymous requests', async () => {
      const context = mockExecutionContext({}, { content: 'hello', lat: 0, lon: 0 });
      await guard.canActivate(context);
      const request = context.switchToHttp().getRequest();
      expect(request.stellarVerified).toBeNull();
    });
  });

  describe('header validation', () => {
    it('should reject when only some headers are provided', async () => {
      const context = mockExecutionContext(
        { 'x-stellar-signature': 'sig' },
        { content: 'hello', lat: 0, lon: 0 },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject with message about all headers required', async () => {
      const context = mockExecutionContext(
        { 'x-stellar-address': 'GABC' },
        { content: 'hello', lat: 0, lon: 0 },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'All X-Stellar-* headers must be provided',
      );
    });
  });

  describe('replay protection', () => {
    it('should reject timestamps older than the window', async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
      const context = mockExecutionContext(
        {
          'x-stellar-signature': 'sig',
          'x-stellar-address': 'GABC',
          'x-stellar-timestamp': String(oldTimestamp),
        },
        { content: 'hello', lat: 0, lon: 0 },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'outside the accepted window',
      );
    });

    it('should reject timestamps in the future beyond clock skew', async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 10;
      const context = mockExecutionContext(
        {
          'x-stellar-signature': 'sig',
          'x-stellar-address': 'GABC',
          'x-stellar-timestamp': String(futureTimestamp),
        },
        { content: 'hello', lat: 0, lon: 0 },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'outside the accepted window',
      );
    });

    it('should accept timestamps within the window', async () => {
      const validTimestamp = Math.floor(Date.now() / 1000) - 10;
      (StrKey.decodeEd25519PublicKey as jest.Mock).mockReturnValue(
        new Uint8Array(32).fill(1),
      );
      (verifyAsync as jest.Mock).mockResolvedValue(true);

      const context = mockExecutionContext(
        {
          'x-stellar-signature': '00'.repeat(64),
          'x-stellar-address': 'GABC',
          'x-stellar-timestamp': String(validTimestamp),
        },
        { content: 'hello', lat: 0, lon: 0 },
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('signature verification', () => {
    it('should reject an invalid Stellar address', async () => {
      (StrKey.decodeEd25519PublicKey as jest.Mock).mockImplementation(() => {
        throw new Error('invalid address');
      });

      const validTimestamp = Math.floor(Date.now() / 1000) - 10;
      const context = mockExecutionContext(
        {
          'x-stellar-signature': '00'.repeat(64),
          'x-stellar-address': 'INVALID',
          'x-stellar-timestamp': String(validTimestamp),
        },
        { content: 'hello', lat: 0, lon: 0 },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid X-Stellar-Address',
      );
    });

    it('should reject when signature verification fails', async () => {
      (StrKey.decodeEd25519PublicKey as jest.Mock).mockReturnValue(
        new Uint8Array(32).fill(1),
      );
      (verifyAsync as jest.Mock).mockResolvedValue(false);

      const validTimestamp = Math.floor(Date.now() / 1000) - 10;
      const context = mockExecutionContext(
        {
          'x-stellar-signature': '00'.repeat(64),
          'x-stellar-address': 'GABC',
          'x-stellar-timestamp': String(validTimestamp),
        },
        { content: 'hello', lat: 0, lon: 0 },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'X-Stellar-Signature verification failed',
      );
    });

    it('should attach verified info on successful verification', async () => {
      const pubKey = new Uint8Array(32).fill(42);
      (StrKey.decodeEd25519PublicKey as jest.Mock).mockReturnValue(pubKey);
      (verifyAsync as jest.Mock).mockResolvedValue(true);

      const validTimestamp = Math.floor(Date.now() / 1000) - 10;
      const context = mockExecutionContext(
        {
          'x-stellar-signature': '00'.repeat(64),
          'x-stellar-address': 'GABCDEF',
          'x-stellar-timestamp': String(validTimestamp),
        },
        { content: 'hello', lat: 0, lon: 0 },
      );
      await guard.canActivate(context);
      const request = context.switchToHttp().getRequest();
      expect(request.stellarVerified).toBeDefined();
      expect(request.stellarVerified.address).toBe('GABCDEF');
      expect(request.stellarVerified.verifiedAt).toBeInstanceOf(Date);
    });
  });
});
