import { auctionLotSchema } from '@monabid/shared';

/** Stable B4 component-test data, validated against the P1 AuctionLot contract. */
export const soldLotFixture = auctionLotSchema.parse({
  id: 'lot-test-sold',
  source: {
    provider: 'test-auction-source',
    recordId: 'test-sold-001',
    url: 'https://example.test/lots/test-sold-001',
    retrievedAt: '2025-08-21T00:00:00.000Z',
  },
  auctionHouse: {
    id: 'test-house',
    name: 'Test Auction House',
  },
  auctionTitle: 'Test auction',
  lotNumber: '001',
  title: {
    en: 'Sold test lot',
    he: 'לוט בדיקה שנמכר',
  },
  description: {
    en: 'A deterministic sold lot for B4 component tests.',
    he: 'לוט שנמכר עבור בדיקות רכיב B4.',
  },
  category: 'test-items',
  saleDate: '2025-01-23',
  status: 'sold',
  estimate: {
    low: { amount: 800, currency: 'USD' },
    high: { amount: 1200, currency: 'USD' },
  },
  realizedPrice: { amount: 1200, currency: 'USD' },
});

export const unsoldLotFixture = auctionLotSchema.parse({
  ...soldLotFixture,
  id: 'lot-test-unsold',
  source: {
    provider: 'test-auction-source',
    recordId: 'test-unsold-001',
    url: 'https://example.test/lots/test-unsold-001',
    retrievedAt: '2025-08-21T00:00:00.000Z',
  },
  lotNumber: '002',
  title: {
    en: 'Unsold test lot',
    he: 'לוט בדיקה שלא נמכר',
  },
  status: 'unsold',
  realizedPrice: undefined,
});
