import { describe, expect, it } from 'vitest';
import { auctionLotSchema } from './auction-lot';

const validSoldLot = {
  id: 'lot-1',
  source: { provider: 'fixture', recordId: '1', url: 'https://example.com/1', retrievedAt: '2025-01-01T00:00:00.000Z' },
  auctionHouse: { id: 'house-1', name: 'House' },
  auctionTitle: 'Auction',
  lotNumber: '1',
  title: { en: 'Lot' },
  description: { en: 'Description' },
  category: 'books',
  saleDate: '2025-01-01',
  status: 'sold',
};

describe('auctionLotSchema', () => {
  it('rejects a realized price without an ISO currency', () => {
    const result = auctionLotSchema.safeParse({
      id: 'lot-1',
      realizedPrice: { amount: 100, currency: '$' },
    });

    expect(result.success).toBe(false);
  });

  it('accepts a sold lot with a non-negative realized price and ISO currency', () => {
    const result = auctionLotSchema.safeParse({
      ...validSoldLot,
      realizedPrice: { amount: 1200, currency: 'USD' },
    });

    expect(result.success).toBe(true);
  });

  it('accepts an unsold lot without a realized price', () => {
    const result = auctionLotSchema.safeParse({
      ...validSoldLot,
      status: 'unsold',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a negative realized price', () => {
    const result = auctionLotSchema.safeParse({
      ...validSoldLot,
      realizedPrice: { amount: -1, currency: 'USD' },
    });

    expect(result.success).toBe(false);
  });

  it('accepts optional canonical filter tokens', () => {
    const result = auctionLotSchema.safeParse({
      ...validSoldLot,
      realizedPrice: { amount: 1200, currency: 'USD' },
      creator: 'yitzhak_abrabanel',
      period: '19th_century',
      medium: 'oil_on_canvas',
      geography: 'israel',
    });

    expect(result.success).toBe(true);
  });

  it('accepts an optional canonical item key for linked sale history', () => {
    const result = auctionLotSchema.safeParse({
      ...validSoldLot,
      itemKey: 'abrabanel_commentary_example',
    });

    expect(result.data).toMatchObject({
      itemKey: 'abrabanel_commentary_example',
    });
  });

  it('rejects an item key that is not snake_case', () => {
    const result = auctionLotSchema.safeParse({
      ...validSoldLot,
      itemKey: 'Abrabanel Commentary',
    });

    expect(result.success).toBe(false);
  });

  it('rejects filter tokens that are not snake_case', () => {
    const result = auctionLotSchema.safeParse({
      ...validSoldLot,
      realizedPrice: { amount: 1200, currency: 'USD' },
      creator: 'Yitzhak Abravanel',
      period: '19th-century',
      medium: 'Oil on canvas',
      geography: 'ישראל',
    });

    expect(result.success).toBe(false);
  });
});
