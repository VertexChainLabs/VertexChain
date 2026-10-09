import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

export interface PostGistResult {
  gistId: string;
  txHash: string;
  mock: boolean;
}

export interface GetGistResult {
  gistId: string;
  locationCell: string;
  contentHash: string;
  createdAt: number;
  mock: boolean;
}

export interface GistEvent {
  gistId: string;
  locationCell: string;
  contentHash: string;
  author: string | null;
  ledger: number;
  createdAt: number;
}

// ─── JSON-RPC types ──────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: unknown;
}

interface JsonRpcSuccess<T> {
  jsonrpc: '2.0';
  id: number;
  result: T;
}

interface JsonRpcError {
  jsonrpc: '2.0';
  id: number;
  error: { code: number; message: string; data?: unknown };
}

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcError;

function isJsonRpcError<T>(res: JsonRpcResponse<T>): res is JsonRpcError {
  return 'error' in res;
}

// ─── Custom error classes ─────────────────────────────────────────────────────

export class SorobanRpcError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'SorobanRpcError';
  }
}

export class SorobanTransportError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'SorobanTransportError';
  }
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function jitter(base: number): number {
  // ±25 % randomised jitter
  return base * (0.75 + Math.random() * 0.5);
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3,
  logger?: Logger,
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;

      // Non-retryable errors (JSON-RPC definitively failed, 4xx HTTP) bubble immediately.
      if (
        (err instanceof SorobanRpcError && !err.retryable) ||
        (err instanceof SorobanTransportError && !err.retryable)
      ) {
        throw err;
      }

      logger?.warn(`${label} attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);
      if (attempt < maxAttempts) {
        const backoff = jitter(200 * Math.pow(2, attempt - 1));
        await sleep(backoff);
      }
    }
  }
  throw lastError;
}

// ─── Low-level JSON-RPC fetch ─────────────────────────────────────────────────

let rpcRequestId = 0;

async function callRpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: ++rpcRequestId,
    method,
    params,
  };

  let rawResponse: Response;
  try {
    rawResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    const isTimeout = msg.includes('abort') || msg.includes('Abort') || msg.includes('signal');
    throw new SorobanTransportError(
      isTimeout ? `Soroban RPC timed out after ${timeoutMs}ms` : `Network error: ${msg}`,
      /* retryable */ true,
    );
  } finally {
    clearTimeout(timer);
  }

  // 4xx → definitive client error, do not retry
  if (rawResponse.status >= 400 && rawResponse.status < 500) {
    throw new SorobanTransportError(
      `Soroban RPC returned HTTP ${rawResponse.status}`,
      /* retryable */ false,
    );
  }

  // 5xx → transient, retry
  if (rawResponse.status >= 500) {
    throw new SorobanTransportError(
      `Soroban RPC returned HTTP ${rawResponse.status}`,
      /* retryable */ true,
    );
  }

  let json: JsonRpcResponse<T>;
  try {
    json = (await rawResponse.json()) as JsonRpcResponse<T>;
  } catch {
    throw new SorobanTransportError('Soroban RPC returned non-JSON body', /* retryable */ false);
  }

  if (isJsonRpcError(json)) {
    const { code, message } = json.error;
    // JSON-RPC -32xxx errors are definitively wrong; anything else (e.g. busy) may be retried.
    const retryable = code > -32000;
    throw new SorobanRpcError(`JSON-RPC error ${code}: ${message}`, code, retryable);
  }

  return json.result;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);
  private readonly mockMode: boolean;
  private readonly maxRetries: number;
  private readonly rpcUrl: string;
  private readonly rpcTimeoutMs: number;
  private readonly contractId: string;

  constructor(private readonly config: ConfigService) {
    const contractId = this.config.get<string>('CONTRACT_ID_GIST_REGISTRY');
    this.mockMode = !contractId;
    this.contractId = contractId ?? '';
    this.maxRetries = this.config.get<number>('SOROBAN_RETRY_ATTEMPTS', 3);
    this.rpcUrl = this.config.get<string>(
      'SOROBAN_RPC_URL',
      'https://soroban-testnet.stellar.org',
    );
    this.rpcTimeoutMs = this.config.get<number>('SOROBAN_RPC_TIMEOUT_MS', 10_000);

    if (this.mockMode) {
      this.logger.warn('Soroban running in MOCK MODE — no blockchain calls will be made');
    } else {
      this.logger.log(
        `Soroban RPC: ${this.rpcUrl} | contract: ${this.contractId} | ` +
          `retries: ${this.maxRetries} | timeout: ${this.rpcTimeoutMs}ms`,
      );
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async postGist(
    locationCell: string,
    contentHash: string,
    author?: string,
  ): Promise<PostGistResult> {
    if (this.mockMode) {
      void locationCell;
      void contentHash;
      void author;
      await this.simulateDelay();
      const gistId = String(Date.now());
      const txHash = `mock_tx_${randomBytes(16).toString('hex')}`;
      this.logger.debug(`MOCK postGist → gistId=${gistId} txHash=${txHash}`);
      return { gistId, txHash, mock: true };
    }

    return withRetry(
      () => this.rpcPostGist(locationCell, contentHash, author),
      'Soroban.postGist',
      this.maxRetries,
      this.logger,
    );
  }

  async getGist(gistId: string): Promise<GetGistResult> {
    if (this.mockMode) {
      await this.simulateDelay();
      return {
        gistId,
        locationCell: 'mock_cell',
        contentHash: `mock_Qm${randomBytes(16).toString('hex')}`,
        createdAt: Math.floor(Date.now() / 1000),
        mock: true,
      };
    }

    return withRetry(
      () => this.rpcGetGist(gistId),
      'Soroban.getGist',
      this.maxRetries,
      this.logger,
    );
  }

  async getEventsSince(ledger: number): Promise<GistEvent[]> {
    if (this.mockMode) {
      this.logger.debug(`MOCK getEventsSince(${ledger}) → []`);
      return [];
    }

    return withRetry(
      () => this.rpcGetEventsSince(ledger),
      'Soroban.getEventsSince',
      this.maxRetries,
      this.logger,
    );
  }

  // ─── Private RPC calls ───────────────────────────────────────────────────────

  private async rpcPostGist(
    locationCell: string,
    contentHash: string,
    author?: string,
  ): Promise<PostGistResult> {
    interface PostGistRpcResult {
      gistId: string;
      txHash: string;
    }

    const result = await callRpc<PostGistRpcResult>(
      this.rpcUrl,
      'soroban_postGist',
      { contractId: this.contractId, locationCell, contentHash, author: author ?? null },
      this.rpcTimeoutMs,
    );

    if (!result || typeof result.gistId !== 'string' || typeof result.txHash !== 'string') {
      throw new SorobanTransportError('Unexpected response shape from postGist RPC', false);
    }

    this.logger.debug(`postGist → gistId=${result.gistId} txHash=${result.txHash}`);
    return { ...result, mock: false };
  }

  private async rpcGetGist(gistId: string): Promise<GetGistResult> {
    interface GetGistRpcResult {
      gistId: string;
      locationCell: string;
      contentHash: string;
      createdAt: number;
    }

    const result = await callRpc<GetGistRpcResult>(
      this.rpcUrl,
      'soroban_getGist',
      { contractId: this.contractId, gistId },
      this.rpcTimeoutMs,
    );

    if (
      !result ||
      typeof result.gistId !== 'string' ||
      typeof result.locationCell !== 'string' ||
      typeof result.contentHash !== 'string' ||
      typeof result.createdAt !== 'number'
    ) {
      throw new SorobanTransportError('Unexpected response shape from getGist RPC', false);
    }

    return { ...result, mock: false };
  }

  private async rpcGetEventsSince(ledger: number): Promise<GistEvent[]> {
    const result = await callRpc<GistEvent[]>(
      this.rpcUrl,
      'soroban_getEventsSince',
      { contractId: this.contractId, ledger },
      this.rpcTimeoutMs,
    );

    if (!Array.isArray(result)) {
      throw new SorobanTransportError('Unexpected response shape from getEventsSince RPC', false);
    }

    return result;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private simulateDelay(): Promise<void> {
    const ms = 100 + Math.floor(Math.random() * 200);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
