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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      logger?.warn(`${label} attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);
      if (attempt < maxAttempts) await sleep(200 * attempt);
    }
  }
  throw lastError;
}

@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);
  private readonly mockMode: boolean;
  private readonly maxRetries: number;

  constructor(private readonly config: ConfigService) {
    const contractId = this.config.get<string>('CONTRACT_ID_GIST_REGISTRY');
    this.mockMode = !contractId;
    this.maxRetries = this.config.get<number>('SOROBAN_RETRY_ATTEMPTS', 3);

    if (this.mockMode) {
      this.logger.warn('Soroban running in MOCK MODE — no blockchain calls will be made');
    }
  }

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
      async () => {
        // TODO: real Soroban RPC call
        throw new Error('Real Soroban integration not yet implemented');
      },
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
      async () => {
        throw new Error('Real Soroban integration not yet implemented');
      },
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
      async () => {
        throw new Error('Real Soroban getEvents not yet implemented');
      },
      'Soroban.getEventsSince',
      this.maxRetries,
      this.logger,
    );
  }

  private simulateDelay(): Promise<void> {
    const ms = 100 + Math.floor(Math.random() * 200);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
