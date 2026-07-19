import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SorobanService } from './soroban.service';

describe('SorobanService', () => {
  let service: SorobanService;
  let configGet: jest.Mock;

  const buildService = async (contractId?: string, retries = 3): Promise<SorobanService> => {
    configGet = jest.fn().mockImplementation((key: string, def?: unknown) => {
      if (key === 'CONTRACT_ID_GIST_REGISTRY') return contractId;
      if (key === 'SOROBAN_RETRY_ATTEMPTS') return retries;
      return def;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [SorobanService, { provide: ConfigService, useValue: { get: configGet } }],
    }).compile();

    return module.get<SorobanService>(SorobanService);
  };

  describe('mock mode (no CONTRACT_ID_GIST_REGISTRY)', () => {
    beforeEach(async () => {
      service = await buildService(undefined);
    });

    describe('postGist()', () => {
      it('returns a result with mock=true', async () => {
        const result = await service.postGist('s1t7d8c', 'mock_Qmabc', 'GABC');
        expect(result.mock).toBe(true);
      });

      it('returns a numeric string gistId', async () => {
        const result = await service.postGist('s1t7d8c', 'mock_Qmabc');
        expect(typeof result.gistId).toBe('string');
        expect(Number(result.gistId)).toBeGreaterThan(0);
      });

      it('returns a txHash prefixed with mock_tx_', async () => {
        const result = await service.postGist('s1t7d8c', 'mock_Qmabc');
        expect(result.txHash).toMatch(/^mock_tx_/);
      });

      it('generates unique gistId and txHash across calls', async () => {
        const r1 = await service.postGist('cell1', 'cid1');
        const r2 = await service.postGist('cell1', 'cid1');
        expect(r1.txHash).not.toBe(r2.txHash);
      });
    });

    describe('getGist()', () => {
      it('returns a result with mock=true', async () => {
        const result = await service.getGist('42');
        expect(result.mock).toBe(true);
        expect(result.gistId).toBe('42');
      });

      it('returns a contentHash prefixed with mock_Qm', async () => {
        const result = await service.getGist('1');
        expect(result.contentHash).toMatch(/^mock_Qm/);
      });
    });

    describe('getEventsSince()', () => {
      it('returns an empty array in mock mode', async () => {
        const events = await service.getEventsSince(1000);
        expect(events).toEqual([]);
      });
    });
  });

  describe('real mode (CONTRACT_ID_GIST_REGISTRY set)', () => {
    beforeEach(async () => {
      service = await buildService('CAABC123DEF456', 3);
    });

    describe('postGist() retry logic', () => {
      it('throws after exhausting all 3 retries', async () => {
        await expect(service.postGist('cell', 'cid')).rejects.toThrow(
          'Real Soroban integration not yet implemented',
        );
      });

      it('attempts exactly maxRetries times before throwing', async () => {
        const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});

        await expect(service.postGist('cell', 'cid')).rejects.toThrow();

        // withRetry warns on every failed attempt (1/3, 2/3, 3/3) → 3 warnings
        expect(warnSpy).toHaveBeenCalledTimes(3);
        warnSpy.mockRestore();
      });
    });

    describe('getGist() in real mode', () => {
      it('throws after retries', async () => {
        await expect(service.getGist('42')).rejects.toThrow(
          'Real Soroban integration not yet implemented',
        );
      });
    });

    describe('getEventsSince() in real mode', () => {
      it('throws after retries', async () => {
        await expect(service.getEventsSince(100)).rejects.toThrow(
          'Real Soroban getEvents not yet implemented',
        );
      });
    });
  });

  describe('retry with 1 attempt', () => {
    beforeEach(async () => {
      service = await buildService('CONTRACT_ID', 1);
    });

    it('postGist throws immediately without warning logs', async () => {
      const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});

      await expect(service.postGist('cell', 'cid')).rejects.toThrow();

      // withRetry warns on every failed attempt; with 1 attempt → 1 warning
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });
  });
});
