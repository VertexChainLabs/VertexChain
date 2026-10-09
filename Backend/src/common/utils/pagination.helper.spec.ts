import { PaginationHelper } from './pagination.helper';

describe('PaginationHelper', () => {
  // ─── encodeCursor / decodeCursor round-trip ──────────────────────────────

  describe('encodeCursor / decodeCursor', () => {
    it('round-trips a Date to a cursor and back to an ISO string', () => {
      const date = new Date('2024-05-10T12:00:00.000Z');
      const cursor = PaginationHelper.encodeCursor(date);
      const decoded = PaginationHelper.decodeCursor(cursor);

      expect(decoded).toBe(date.toISOString());
    });

    it('produces a base64 string', () => {
      const cursor = PaginationHelper.encodeCursor(new Date());
      expect(Buffer.from(cursor, 'base64').toString('base64')).toBe(cursor);
    });

    it('returns null for an empty string cursor', () => {
      expect(PaginationHelper.decodeCursor('')).toBeNull();
    });

    it('returns null for a corrupt / non-base64 cursor', () => {
      expect(PaginationHelper.decodeCursor('!!!notbase64!!!')).toBeNull();
    });

    it('returns null for a base64 string that decodes to a non-ISO value', () => {
      const nonIso = Buffer.from('not-a-date').toString('base64');
      expect(PaginationHelper.decodeCursor(nonIso)).toBeNull();
    });

    it('returns null for a base64 string of a random word', () => {
      const cursor = Buffer.from('hello').toString('base64');
      expect(PaginationHelper.decodeCursor(cursor)).toBeNull();
    });

    it('decoded cursor value matches original date', () => {
      const date = new Date('2023-01-01T00:00:00.000Z');
      const cursor = PaginationHelper.encodeCursor(date);
      const decoded = PaginationHelper.decodeCursor(cursor);
      expect(new Date(decoded!).getTime()).toBe(date.getTime());
    });
  });

  // ─── buildResponse — boundary values ─────────────────────────────────────

  describe('buildResponse', () => {
    type Item = { id: number; created_at: Date };

    const makeItems = (count: number): Item[] =>
      Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        created_at: new Date(`2024-0${i + 1}-01T00:00:00.000Z`),
      }));

    it('sets hasMore=true and provides a cursor when items.length === limit', () => {
      const items = makeItems(3);
      const result = PaginationHelper.buildResponse(items, 3);

      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.cursor).not.toBeNull();
    });

    it('cursor decodes back to the created_at of the last item', () => {
      const items = makeItems(3);
      const result = PaginationHelper.buildResponse(items, 3);

      const last = items[items.length - 1];
      const decoded = PaginationHelper.decodeCursor(result.pagination.cursor!);
      expect(new Date(decoded!).getTime()).toBe(last.created_at.getTime());
    });

    it('sets hasMore=false and cursor=null when items.length < limit', () => {
      const items = makeItems(2);
      const result = PaginationHelper.buildResponse(items, 10);

      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.cursor).toBeNull();
    });

    it('returns correct count equal to items.length', () => {
      const items = makeItems(5);
      const result = PaginationHelper.buildResponse(items, 10);
      expect(result.pagination.count).toBe(5);
    });

    it('returns empty data and no cursor for an empty list', () => {
      const result = PaginationHelper.buildResponse([], 10);

      expect(result.data).toEqual([]);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.cursor).toBeNull();
      expect(result.pagination.count).toBe(0);
    });

    it('data array contains the original items', () => {
      const items = makeItems(2);
      const result = PaginationHelper.buildResponse(items, 5);
      expect(result.data).toEqual(items);
    });

    it('no cursor when limit is 0 (edge-case: empty page at limit 0)', () => {
      // items.length (0) === limit (0) but there is no last item
      const result = PaginationHelper.buildResponse([], 0);
      expect(result.pagination.cursor).toBeNull();
    });
  });
});
