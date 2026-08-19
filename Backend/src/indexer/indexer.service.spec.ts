import * as fs from 'fs';
import { IndexerService } from './indexer.service';
import { SorobanService, GistEvent } from '../soroban/soroban.service';
import { GistRepository } from '../gists/gist.repository';
import { GeoService } from '../geo/geo.service';

const fakeEvent = (overrides: Partial<GistEvent> = {}): GistEvent => ({
  gistId: 'g1',
  locationCell: 's1t7d8c',
  contentHash: 'cid-1',
  author: null,
  ledger: 1000,
  createdAt: 1710000000,
  ...overrides,
});

describe('IndexerService', () => {
  let soroban: jest.Mocked<SorobanService>;
  let gistRepository: jest.Mocked<GistRepository>;
  let geoService: jest.Mocked<GeoService>;

  beforeEach(() => {
    soroban = { getEventsSince: jest.fn() } as unknown as jest.Mocked<SorobanService>;
    gistRepository = {
      upsertFromEvent: jest.fn(),
    } as unknown as jest.Mocked<GistRepository>;
    geoService = { decode: jest.fn() } as unknown as jest.Mocked<GeoService>;

    geoService.decode.mockReturnValue({ lat: 9.0579, lon: 7.4951 });
    gistRepository.upsertFromEvent.mockResolvedValue({ id: 'uuid' } as never);

    // Keep the cursor persistence in-memory for tests.
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const makeService = () => new IndexerService(soroban, gistRepository, geoService);

  it('advances the cursor by event.ledger and keeps created_at from event.createdAt', async () => {
    soroban.getEventsSince.mockResolvedValue([
      fakeEvent({ gistId: 'onchain-1', ledger: 1000, createdAt: 1710000000 }),
    ]);

    const service = makeService();
    await (service as any).poll();

    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), '1000');
    expect((service as any).lastProcessedLedger).toBe(1000);
    expect(gistRepository.upsertFromEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stellar_gist_id: 'onchain-1',
        created_at: new Date(1710000000 * 1000),
      }),
    );
  });

  it('resumes from the persisted ledger sequence after a restart, not a timestamp', async () => {
    soroban.getEventsSince.mockResolvedValue([
      fakeEvent({ gistId: 'onchain-1', ledger: 1000, createdAt: 1710000000 }),
    ]);

    const first = makeService();
    await (first as any).poll();
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), '1000');

    // Simulate a restart: the cursor file now contains the sequence "1000".
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('1000' as never);

    const restarted = makeService();
    (restarted as any).loadCursor();
    expect((restarted as any).lastProcessedLedger).toBe(1000);

    soroban.getEventsSince.mockResolvedValue([]);
    await (restarted as any).poll();
    expect(soroban.getEventsSince).toHaveBeenLastCalledWith(1000);
  });

  it('does not advance the cursor past a failed upsert', async () => {
    const ok = fakeEvent({ gistId: 'ok', ledger: 100, createdAt: 1710000000 });
    const fail = fakeEvent({ gistId: 'fail', ledger: 200, createdAt: 1710000060 });
    const skipped = fakeEvent({ gistId: 'skipped', ledger: 300, createdAt: 1710000120 });
    soroban.getEventsSince.mockResolvedValue([ok, fail, skipped]);

    gistRepository.upsertFromEvent
      .mockResolvedValueOnce({ id: 'uuid-ok' } as never)
      .mockRejectedValueOnce(new Error('db down'));

    const service = makeService();
    await (service as any).poll();

    expect((service as any).lastProcessedLedger).toBe(100);
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), '100');
    // ok + fail were attempted; the event after the failure was not.
    expect(gistRepository.upsertFromEvent).toHaveBeenCalledTimes(2);
  });
});
