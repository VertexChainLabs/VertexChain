import { PaginationHelper } from './pagination.helper';

interface Item {
  id: string;
  created_at: Date;
}

const item = (id: string, createdAt: string): Item => ({
  id,
  created_at: new Date(createdAt),
});

describe('PaginationHelper', () => {
  describe('encodeCursor()', () => {
    it('encodes a date as a base64 ISO string', () => {
      const date = new Date('2026-01-01T00:00:00.000Z');

      expect(PaginationHelper.encodeCursor(date)).toBe(
        Buffer.from('2026-01-01T00:00:00.000Z').toString('base64'),
      );
    });

    it('produces a cursor that is safe in a query string once encoded', () => {
      const cursor = PaginationHelper.encodeCursor(new Date('2026-06-15T12:30:45.123Z'));

      expect(cursor).not.toContain('+');
      expect(cursor).not.toContain('/');
      expect(cursor).not.toContain('=');
    });
  });

  describe('decodeCursor()', () => {
    it('round-trips an encoded cursor back to the ISO date', () => {
      const date = new Date('2026-01-01T00:00:00.000Z');

      expect(PaginationHelper.decodeCursor(PaginationHelper.encodeCursor(date))).toBe(
        '2026-01-01T00:00:00.000Z',
      );
    });

    it('round-trips the epoch boundary', () => {
      const date = new Date('1970-01-01T00:00:00.000Z');

      expect(PaginationHelper.decodeCursor(PaginationHelper.encodeCursor(date))).toBe(
        '1970-01-01T00:00:00.000Z',
      );
    });

    it('returns null for a cursor that is not base64 encoded ISO date', () => {
      expect(PaginationHelper.decodeCursor('not-a-cursor')).toBeNull();
    });

    it('returns null for arbitrary base64 that does not decode to a date', () => {
      const cursor = Buffer.from('hello world').toString('base64');

      expect(PaginationHelper.decodeCursor(cursor)).toBeNull();
    });

    it('returns null for a base64 encoded non-date string', () => {
      const cursor = Buffer.from('not-a-date').toString('base64');

      expect(PaginationHelper.decodeCursor(cursor)).toBeNull();
    });

    it('returns null for an empty cursor', () => {
      expect(PaginationHelper.decodeCursor('')).toBeNull();
    });

    it('returns null for a cursor containing invalid base64 characters', () => {
      expect(PaginationHelper.decodeCursor('!!!! ****')).toBeNull();
    });
  });

  describe('buildResponse()', () => {
    const items = [
      item('1', '2026-01-03T00:00:00.000Z'),
      item('2', '2026-01-02T00:00:00.000Z'),
      item('3', '2026-01-01T00:00:00.000Z'),
    ];

    it('returns the items as data and the total as count', () => {
      const response = PaginationHelper.buildResponse(items, 10);

      expect(response.data).toEqual(items);
      expect(response.pagination.count).toBe(3);
    });

    it('reports hasMore=false and no cursor when fewer items than the limit are returned', () => {
      const response = PaginationHelper.buildResponse(items, 10);

      expect(response.pagination.hasMore).toBe(false);
      expect(response.pagination.cursor).toBeNull();
    });

    it('reports hasMore=true and encodes the last item cursor when the page is full', () => {
      const response = PaginationHelper.buildResponse(items, 3);

      expect(response.pagination.hasMore).toBe(true);
      expect(response.pagination.cursor).not.toBeNull();
      expect(PaginationHelper.decodeCursor(response.pagination.cursor as string)).toBe(
        '2026-01-01T00:00:00.000Z',
      );
    });

    it('returns an empty page for an empty item list', () => {
      const response = PaginationHelper.buildResponse([], 10);

      expect(response.data).toEqual([]);
      expect(response.pagination).toEqual({ count: 0, cursor: null, hasMore: false });
    });

    it('returns a single item page below the limit without a cursor', () => {
      const response = PaginationHelper.buildResponse([items[0]], 1);

      expect(response.pagination.count).toBe(1);
      expect(response.pagination.hasMore).toBe(true);
      expect(PaginationHelper.decodeCursor(response.pagination.cursor as string)).toBe(
        '2026-01-03T00:00:00.000Z',
      );
    });

    it('returns hasMore=true with a null cursor when the limit is zero', () => {
      const response = PaginationHelper.buildResponse([], 0);

      expect(response.pagination.hasMore).toBe(true);
      expect(response.pagination.cursor).toBeNull();
    });

    it('round-trips the cursor through a follow-up decode', () => {
      const fullPage = PaginationHelper.buildResponse(items, 3);
      const decoded = PaginationHelper.decodeCursor(fullPage.pagination.cursor as string);

      expect(decoded).toBe(items[2].created_at.toISOString());
      expect(new Date(decoded as string).getTime()).toBe(items[2].created_at.getTime());
    });
  });
});
