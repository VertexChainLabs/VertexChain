import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SorobanService } from '../soroban/soroban.service';
import { GistRepository } from '../gists/gist.repository';
import { GeoService } from '../geo/geo.service';

@Injectable()
export class IndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexerService.name);
  private lastProcessedLedger = 0;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly cursorFilePath = join(process.cwd(), '.indexer-cursor');

  constructor(
    private readonly soroban: SorobanService,
    private readonly gistRepository: GistRepository,
    private readonly geoService: GeoService,
  ) {}

  onModuleInit() {
    this.loadCursor();
    this.logger.log(
      `Indexer starting — polling Soroban for GistRegistry events from ledger ${this.lastProcessedLedger}`,
    );
    this.startPolling();
  }

  onModuleDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  private startPolling(intervalMs = 6_000) {
    this.pollInterval = setInterval(() => {
      void this.poll();
    }, intervalMs);
  }

  private loadCursor(): void {
    try {
      if (existsSync(this.cursorFilePath)) {
        const data = readFileSync(this.cursorFilePath, 'utf-8').trim();
        const parsed = parseInt(data, 10);
        if (!isNaN(parsed) && parsed > 0) {
          this.lastProcessedLedger = parsed;
          this.logger.log(`Resumed from persisted cursor: ledger ${this.lastProcessedLedger}`);
          return;
        }
      }
    } catch (err) {
      this.logger.warn('Could not load cursor file, starting from 0', err);
    }
    this.lastProcessedLedger = 0;
  }

  private saveCursor(ledger: number): void {
    try {
      writeFileSync(this.cursorFilePath, String(ledger));
    } catch (err) {
      this.logger.error('Failed to persist indexer cursor', err);
    }
  }

  private async poll() {
    try {
      const events = await this.soroban.getEventsSince(this.lastProcessedLedger);

      if (events.length === 0) return;

      this.logger.log(
        `Indexer: ${events.length} new event(s) from ledger ${this.lastProcessedLedger}`,
      );

      let indexedCount = 0;
      let maxLedger = this.lastProcessedLedger;

      for (const event of events) {
        try {
          const { lat, lon } = this.geoService.decode(event.locationCell);

          await this.gistRepository.upsertFromEvent({
            stellar_gist_id: event.gistId,
            location_cell: event.locationCell,
            content_hash: event.contentHash,
            lat,
            lon,
            created_at: new Date(event.createdAt * 1000),
          });

          maxLedger = Math.max(maxLedger, event.createdAt);
          indexedCount++;

          this.logger.debug(
            `Indexed gist ${event.gistId} @ cell ${event.locationCell} (ledger ${event.createdAt})`,
          );
        } catch (eventErr) {
          this.logger.error(
            `Failed to index event for gist ${event.gistId} @ cell ${event.locationCell}`,
            eventErr,
          );
        }
      }

      if (maxLedger > this.lastProcessedLedger) {
        this.lastProcessedLedger = maxLedger;
        this.saveCursor(this.lastProcessedLedger);
      }

      this.logger.log(`Indexer: ${indexedCount}/${events.length} events upserted successfully`);
    } catch (err) {
      this.logger.error('Indexer poll failed', err);
    }
  }
}
