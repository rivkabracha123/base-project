import { describe, expect, it } from 'vitest';
import { auctionLotSchema } from './auction-lot';

describe('auctionLotSchema', () => {
  it('rejects a realized price without an ISO currency', () => {
    const result = auctionLotSchema.safeParse({
      id: 'lot-1',
      realizedPrice: { amount: 100, currency: '$' },
    });

    expect(result.success).toBe(false);
  });
});
