import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  SorobanService,
  SorobanRpcError,
  SorobanTransportError,
} from './soroban.service';

// ─── helpers ──────────────────────────────────────────────────────────────────

const buildService = async (contractId?: string, retries = 3): Promise<SorobanService> => {
  const configGet = jest.fn().mockImplementation((key: string, def?: unknown) => {
    if (key === 'CONTRACT_ID_GIST_REGISTRY') return contractId;
    if (key === 'SOROBAN_RETRY_ATTEMPTS') return retries;
    if (key === 'SOROBAN_RPC_URL') return 'https://rpc.test';
    if (key === 'SOROBAN_RPC_TIMEOUT_MS') return 5_000;
    return def;
  });

  const module: TestingModule = await Test.createTestingModule({
    providers: [SorobanService, { provide: ConfigService, useValue: { get: configGet } }],
  }).compile();

  return module.get<SorobanService>(SorobanService);
};

// ─── shared fetch mock setup ──────────────────────────────────────────────────

function mockFetchOnce(options: {
  status?: number;
  body?: unknown;
  throws?: Error;
}): void {
  const { status = 200, body, throws } = options;
  (global.fetch as jest.Mock).mockImplementationOnce(() => {
    if (throws) return Promise.reject(throws);
    return Promise.resolve({
      status,
      json: () =>
        body !== undefined ? Promise.resolve(body) : Promise.reject(new Error('no body')),
    });
  });
}

function rpcSuccess<T>(result: T, id = 1) {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(code: number, message: string, id = 1) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('SorobanService', () => {
  let service: SorobanService;

  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // MOCK MODE (no CONTRACT_ID_GIST_REGISTRY)
  // ──────────────────────────────────────────────────────────────────────────

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

      it('does not call fetch in mock mode', async () => {
        await service.postGist('cell', 'cid');
        expect(global.fetch).not.toHaveBeenCalled();
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

      it('does not call fetch in mock mode', async () => {
        await service.getGist('1');
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    describe('getEventsSince()', () => {
      it('returns an empty array in mock mode', async () => {
        const events = await service.getEventsSince(1000);
        expect(events).toEqual([]);
      });

      it('does not call fetch in mock mode', async () => {
        await service.getEventsSince(0);
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // REAL MODE — success paths
  // ──────────────────────────────────────────────────────────────────────────

  describe('real mode — success paths', () => {
    beforeEach(async () => {
      service = await buildService('CAABC123DEF456', 3);
    });

    it('postGist() resolves with mock=false on a successful RPC response', async () => {
      mockFetchOnce({
        body: rpcSuccess({ gistId: 'gist-1', txHash: 'tx-abc' }),
      });

      const result = await service.postGist('cell', 'Qmhash', 'GABC');

      expect(result.mock).toBe(false);
      expect(result.gistId).toBe('gist-1');
      expect(result.txHash).toBe('tx-abc');
    });

    it('getGist() resolves with mock=false on a successful RPC response', async () => {
      mockFetchOnce({
        body: rpcSuccess({
          gistId: '42',
          locationCell: 'cell-X',
          contentHash: 'QmABC',
          createdAt: 1_700_000_000,
        }),
      });

      const result = await service.getGist('42');

      expect(result.mock).toBe(false);
      expect(result.gistId).toBe('42');
      expect(result.locationCell).toBe('cell-X');
      expect(result.contentHash).toBe('QmABC');
      expect(result.createdAt).toBe(1_700_000_000);
    });

    it('getEventsSince() resolves with an array of events', async () => {
      const events = [
        {
          gistId: 'g1',
          locationCell: 'c1',
          contentHash: 'h1',
          author: 'GABC',
          ledger: 200,
          createdAt: 1_700_000_001,
        },
      ];
      mockFetchOnce({ body: rpcSuccess(events) });

      const result = await service.getEventsSince(100);

      expect(result).toEqual(events);
    });

    it('posts correct JSON-RPC 2.0 payload', async () => {
      mockFetchOnce({
        body: rpcSuccess({ gistId: 'g', txHash: 't' }),
      });

      await service.postGist('cell', 'hash', 'GABC');

      const call = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(call[1].body as string) as {
        jsonrpc: string;
        method: string;
        params: unknown;
      };
      expect(requestBody.jsonrpc).toBe('2.0');
      expect(requestBody.method).toBe('soroban_postGist');
      expect(requestBody.params).toMatchObject({
        contractId: 'CAABC123DEF456',
        locationCell: 'cell',
        contentHash: 'hash',
        author: 'GABC',
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // REAL MODE — retry: 5xx followed by success
  // ──────────────────────────────────────────────────────────────────────────

  describe('real mode — retry on transient failures', () => {
    beforeEach(async () => {
      service = await buildService('CAABC123DEF456', 3);
    });

    it('retries after HTTP 503 and succeeds on second attempt', async () => {
      // First call → 503, second call → success
      mockFetchOnce({ status: 503, body: { error: 'service unavailable' } });
      mockFetchOnce({ body: rpcSuccess({ gistId: 'g2', txHash: 'tx2' }) });

      const warnSpy = jest
        .spyOn((service as unknown as { logger: { warn: () => void } }).logger, 'warn')
        .mockImplementation(() => {});

      const result = await service.postGist('cell', 'hash');

      expect(result.gistId).toBe('g2');
      expect(warnSpy).toHaveBeenCalledTimes(1); // one failed attempt logged
    });

    it('retries on network error and succeeds', async () => {
      mockFetchOnce({ throws: new Error('ECONNREFUSED') });
      mockFetchOnce({ body: rpcSuccess({ gistId: 'g3', txHash: 'tx3' }) });

      const warnSpy = jest
        .spyOn((service as unknown as { logger: { warn: () => void } }).logger, 'warn')
        .mockImplementation(() => {});

      const result = await service.postGist('cell', 'hash');

      expect(result.gistId).toBe('g3');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('exhausts retries and throws after repeated 503s', async () => {
      mockFetchOnce({ status: 503, body: {} });
      mockFetchOnce({ status: 503, body: {} });
      mockFetchOnce({ status: 503, body: {} });

      await expect(service.postGist('cell', 'hash')).rejects.toThrow(SorobanTransportError);
    });

    it('retries up to maxRetries times', async () => {
      mockFetchOnce({ status: 500, body: {} });
      mockFetchOnce({ status: 500, body: {} });
      mockFetchOnce({ status: 500, body: {} });

      const warnSpy = jest
        .spyOn((service as unknown as { logger: { warn: () => void } }).logger, 'warn')
        .mockImplementation(() => {});

      await expect(service.postGist('cell', 'hash')).rejects.toThrow();
      expect(warnSpy).toHaveBeenCalledTimes(3);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // REAL MODE — timeout / abort
  // ──────────────────────────────────────────────────────────────────────────

  describe('real mode — timeout / abort', () => {
    beforeEach(async () => {
      service = await buildService('CAABC123DEF456', 1);
    });

    it('throws a SorobanTransportError on AbortError', async () => {
      const abortErr = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      mockFetchOnce({ throws: abortErr });

      await expect(service.postGist('cell', 'hash')).rejects.toBeInstanceOf(SorobanTransportError);
    });

    it('abort error message mentions timeout', async () => {
      const abortErr = Object.assign(new Error('abort'), { name: 'AbortError' });
      mockFetchOnce({ throws: abortErr });

      const err = await service.postGist('cell', 'hash').catch((e: Error) => e);
      expect((err as SorobanTransportError).message).toMatch(/timed out/i);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // REAL MODE — malformed / non-JSON body
  // ──────────────────────────────────────────────────────────────────────────

  describe('real mode — malformed / non-JSON body', () => {
    beforeEach(async () => {
      service = await buildService('CAABC123DEF456', 1);
    });

    it('throws SorobanTransportError when body is not valid JSON', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          status: 200,
          json: () => Promise.reject(new SyntaxError('Unexpected token')),
        }),
      );

      await expect(service.postGist('cell', 'hash')).rejects.toBeInstanceOf(SorobanTransportError);
    });

    it('throws SorobanTransportError when result shape is wrong', async () => {
      mockFetchOnce({ body: rpcSuccess({ unexpected: true }) });

      await expect(service.postGist('cell', 'hash')).rejects.toBeInstanceOf(SorobanTransportError);
    });

    it('throws SorobanTransportError when getEventsSince result is not an array', async () => {
      mockFetchOnce({ body: rpcSuccess({ notAnArray: true }) });

      await expect(service.getEventsSince(0)).rejects.toBeInstanceOf(SorobanTransportError);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // REAL MODE — JSON-RPC errors (no retry for definitively wrong calls)
  // ──────────────────────────────────────────────────────────────────────────

  describe('real mode — JSON-RPC errors', () => {
    beforeEach(async () => {
      service = await buildService('CAABC123DEF456', 3);
    });

    it('throws SorobanRpcError and does NOT retry on -32602 (invalid params)', async () => {
      mockFetchOnce({ body: rpcError(-32602, 'Invalid params') });

      await expect(service.postGist('cell', 'hash')).rejects.toBeInstanceOf(SorobanRpcError);
      // fetch called exactly once — no retry
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('throws SorobanRpcError and does NOT retry on -32601 (method not found)', async () => {
      mockFetchOnce({ body: rpcError(-32601, 'Method not found') });

      await expect(service.getGist('1')).rejects.toBeInstanceOf(SorobanRpcError);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry on HTTP 400', async () => {
      mockFetchOnce({ status: 400, body: {} });

      await expect(service.postGist('cell', 'hash')).rejects.toBeInstanceOf(SorobanTransportError);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry on HTTP 404', async () => {
      mockFetchOnce({ status: 404, body: {} });

      await expect(service.getGist('999')).rejects.toBeInstanceOf(SorobanTransportError);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Legacy: real mode with 1 attempt
  // ──────────────────────────────────────────────────────────────────────────

  describe('retry with 1 attempt', () => {
    beforeEach(async () => {
      service = await buildService('CONTRACT_ID', 1);
    });

    it('postGist throws after one attempt with a transport error', async () => {
      mockFetchOnce({ status: 503, body: {} });

      const warnSpy = jest
        .spyOn((service as unknown as { logger: { warn: () => void } }).logger, 'warn')
        .mockImplementation(() => {});

      await expect(service.postGist('cell', 'cid')).rejects.toThrow();
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });
});
