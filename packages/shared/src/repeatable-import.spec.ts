import { describe, expect, it } from 'vitest';
import { validateAuctionLotFixture, type AuctionLot } from './import-report';

// A minimal in-memory stand-in for the real upsert-by-id behavior in seed.ts
// (repository.upsert(records, ['id'])) — test-only, not production code.
class FakeAuctionLotStore {
  private records = new Map<string, AuctionLot>();

  importBatch(batch: unknown[]): void {
    const { records } = validateAuctionLotFixture(batch);
    for (const record of records) {
      this.records.set(record.id, record); // same id overwrites, like upsert
    }
  }

  all(): AuctionLot[] {
    return [...this.records.values()];
  }
}

const baseLot = {
  source: { provider: 'fixture', recordId: '1', url: 'https://example.com/1', retrievedAt: '2025-01-01T00:00:00.000Z' },
  auctionHouse: { id: 'house-1', name: 'House' },
  auctionTitle: 'Auction',
  lotNumber: '1',
  title: { en: 'Lot' },
  description: { en: 'Description' },
  category: 'books',
  saleDate: '2025-01-01',
  status: 'sold' as const,
  realizedPrice: { amount: 1000, currency: 'USD' },
};

describe('repeatable fixture import', () => {
  it('re-importing the same batch does not duplicate records, and a new record can be added alongside existing ones', () => {
    const store = new FakeAuctionLotStore();

    store.importBatch([
      { ...baseLot, id: 'lot-1' },
      { ...baseLot, id: 'lot-2' },
    ]);
    store.importBatch([
      { ...baseLot, id: 'lot-1' },
      { ...baseLot, id: 'lot-2' },
      { ...baseLot, id: 'lot-3' }, // new record added on the second run
    ]);

    expect(store.all().map((lot) => lot.id).sort()).toEqual(['lot-1', 'lot-2', 'lot-3']);
  });

  it('re-importing with an updated value for an existing id applies the correction', () => {
    const store = new FakeAuctionLotStore();

    store.importBatch([{ ...baseLot, id: 'lot-1', realizedPrice: { amount: 1000, currency: 'USD' } }]);
    store.importBatch([{ ...baseLot, id: 'lot-1', realizedPrice: { amount: 1200, currency: 'USD' } }]);

    expect(store.all()).toHaveLength(1);
    expect(store.all()[0].realizedPrice).toEqual({ amount: 1200, currency: 'USD' });
  });

  it('re-importing with a status change from upcoming to sold applies the full update', () => {
    const store = new FakeAuctionLotStore();
    const { realizedPrice: _realizedPrice, ...upcomingLot } = baseLot;

    store.importBatch([{ ...upcomingLot, id: 'lot-1', status: 'upcoming' }]);
    store.importBatch([{ ...baseLot, id: 'lot-1', status: 'sold', realizedPrice: { amount: 1500, currency: 'USD' } }]);

    expect(store.all()).toHaveLength(1);
    expect(store.all()[0]).toMatchObject({
      status: 'sold',
      realizedPrice: { amount: 1500, currency: 'USD' },
    });
  });
});
