import { describe, expect, it } from 'vitest';
import { MATCH_REASON_FIELDS, matchReasonSchema } from './match-reason';

describe('match reason', () => {
  // Consumers rely on this order: free text first, then the list filters, then dateRange and price.
  it('lists the fields a reason can name, in reporting order', () => {
    expect(MATCH_REASON_FIELDS).toEqual([
      'query',
      'categories',
      'creators',
      'auctionHouseIds',
      'geography',
      'media',
      'statuses',
      'periods',
      'dateRange',
      'price',
    ]);
  });

  it('accepts a reason that names a listed field and carries its detail', () => {
    expect(matchReasonSchema.parse({ field: 'categories', detail: 'ספרים נדירים' })).toEqual({
      field: 'categories',
      detail: 'ספרים נדירים',
    });
  });

  it('rejects a reason that names a field that is not listed', () => {
    expect(matchReasonSchema.safeParse({ field: 'color', detail: 'red' }).success).toBe(false);
  });
});
