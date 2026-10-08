import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { StrKey } from '@stellar/stellar-sdk';
import { verifyAsync } from '@noble/ed25519';
import * as request from 'supertest';
import { StellarVerifiedUser } from './stellar-verified.decorator';
import { StellarAuthGuard } from '../guards/stellar-auth.guard';
import { StellarVerified } from '../interfaces/stellar-verified.interface';

jest.mock('@stellar/stellar-sdk', () => ({
  StrKey: {
    decodeEd25519PublicKey: jest.fn(),
  },
}));

jest.mock('@noble/ed25519', () => ({
  verifyAsync: jest.fn(),
}));

@Controller('probe')
class ProbeController {
  @Get()
  @UseGuards(StellarAuthGuard)
  handle(@StellarVerifiedUser() stellarVerified: StellarVerified | null): unknown {
    return { stellarVerified };
  }
}

type ParamMetadata = { factory: (data: unknown, ctx: unknown) => unknown };

function readFactory(): ParamMetadata['factory'] {
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, ProbeController, 'handle') as Record<
    string,
    ParamMetadata
  >;
  return Object.values(args)[0].factory;
}

function contextWith(request: unknown): any {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

describe('StellarVerifiedUser decorator', () => {
  describe('param factory', () => {
    const factory = readFactory();

    it('returns the stellarVerified payload set on the request', () => {
      const stellarVerified: StellarVerified = {
        address: 'GABC',
        verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      };

      expect(factory(null, contextWith({ stellarVerified }))).toEqual(stellarVerified);
    });

    it('returns null when the request carries no stellarVerified', () => {
      expect(factory(null, contextWith({}))).toBeNull();
    });

    it('returns null when stellarVerified is explicitly null', () => {
      expect(factory(undefined, contextWith({ stellarVerified: null }))).toBeNull();
    });

    it('ignores the decorator data argument', () => {
      const stellarVerified: StellarVerified = { address: 'GABC', verifiedAt: new Date() };

      expect(factory('ignored', contextWith({ stellarVerified }))).toEqual(stellarVerified);
    });
  });

  describe('guard integration', () => {
    let app: INestApplication;
    let configGet: jest.Mock;

    beforeEach(async () => {
      configGet = jest.fn().mockReturnValue(300);

      const module = await Test.createTestingModule({
        controllers: [ProbeController],
        providers: [{ provide: ConfigService, useValue: { get: configGet } }],
      }).compile();

      app = module.createNestApplication();
      await app.init();
    });

    afterEach(async () => {
      await app.close();
      jest.clearAllMocks();
    });

    it('returns null for an anonymous request', async () => {
      const res = await request(app.getHttpServer()).get('/probe').expect(200);

      expect(res.body).toEqual({ stellarVerified: null });
    });

    it('surfaces the address verified by StellarAuthGuard', async () => {
      (StrKey.decodeEd25519PublicKey as jest.Mock).mockReturnValue(new Uint8Array(32).fill(1));
      (verifyAsync as jest.Mock).mockResolvedValue(true);

      const timestamp = Math.floor(Date.now() / 1000) - 10;
      const res = await request(app.getHttpServer())
        .get('/probe')
        .set('x-stellar-signature', 'ab'.repeat(64))
        .set('x-stellar-address', 'GVERIFIED')
        .set('x-stellar-timestamp', String(timestamp))
        .expect(200);

      expect(res.body.stellarVerified).toBeDefined();
      expect(res.body.stellarVerified.address).toBe('GVERIFIED');
      expect(new Date(res.body.stellarVerified.verifiedAt)).toBeInstanceOf(Date);
    });

    it('rejects before the decorator when verification fails', async () => {
      (StrKey.decodeEd25519PublicKey as jest.Mock).mockReturnValue(new Uint8Array(32).fill(1));
      (verifyAsync as jest.Mock).mockResolvedValue(false);

      const timestamp = Math.floor(Date.now() / 1000) - 10;
      await request(app.getHttpServer())
        .get('/probe')
        .set('x-stellar-signature', 'ab'.repeat(64))
        .set('x-stellar-address', 'GFORGED')
        .set('x-stellar-timestamp', String(timestamp))
        .expect(401);
    });
  });
});
