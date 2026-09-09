import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateAuctionLotFixture } from './import-report';

const validLot = {
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
  realizedPrice: { amount: 1200, currency: 'USD' },
};

// Builds a canonical lot from validLot so behaviour tests supply their own data
// instead of depending on the committed fixture file.
type LotOverrides = Partial<typeof validLot> & { id: string; itemKey?: string; status?: string };
const makeLot = (overrides: LotOverrides) => ({ ...validLot, ...overrides });

describe('validateAuctionLotFixture', () => {
  async function readCommittedFixture(): Promise<unknown> {
    const fixturePath = resolve(import.meta.dirname, '../../../fixtures/auction-data/lots.json');
    return JSON.parse(await readFile(fixturePath, 'utf8')) as unknown;
  }

  it('returns accepted canonical records and an import report', () => {
    const result = validateAuctionLotFixture([validLot]);

    expect(result.records).toEqual([validLot]);
    expect(result.report).toEqual({
      total: 1,
      accepted: 1,
      rejected: 0,
      duplicateIds: [],
      validationErrors: [],
    });
  });

  it('rejects duplicate IDs before import', () => {
    const result = validateAuctionLotFixture([validLot, { ...validLot, lotNumber: '2' }]);

    expect(result.records).toEqual([]);
    expect(result.report.duplicateIds).toEqual(['lot-1']);
    expect(result.report.rejected).toBe(2);
  });

  it('rejects incomplete records before import', () => {
    const result = validateAuctionLotFixture([{ id: 'incomplete' }]);

    expect(result.records).toEqual([]);
    expect(result.report.accepted).toBe(0);
    expect(result.report.rejected).toBe(1);
    expect(result.report.validationErrors).toHaveLength(1);
  });

  it('keeps the committed fixture free of private contact fields', async () => {
    const fixture = await readCommittedFixture();
    const serialized = JSON.stringify(fixture).toLowerCase();

    expect(serialized).not.toMatch(/email|phone|bidder|consignor|verification|credential|conversation/);
  });

  it('preserves fields needed by search and comparable consumers', async () => {
    const result = validateAuctionLotFixture(await readCommittedFixture());
    const [lot] = result.records;

    expect(lot).toMatchObject({
      id: expect.any(String),
      title: { en: expect.any(String) },
      description: { en: expect.any(String) },
      category: expect.any(String),
      status: expect.any(String),
      source: { url: expect.any(String) },
    });
  });

  // The validator hands back realized price, currency and source lineage untouched for every sold lot.
  it('provides traceable historical sales with original prices and currencies', () => {
    const result = validateAuctionLotFixture([
      makeLot({ id: 'sale-1', realizedPrice: { amount: 1200, currency: 'USD' } }),
      makeLot({ id: 'sale-2', realizedPrice: { amount: 900, currency: 'EUR' } }),
    ]);
    const historicalSales = result.records.filter((lot) => lot.status === 'sold');

    expect(historicalSales).not.toHaveLength(0);
    for (const sale of historicalSales) {
      expect(sale).toEqual(expect.objectContaining({
        realizedPrice: expect.objectContaining({
          amount: expect.any(Number),
          currency: expect.stringMatching(/^[A-Z]{3}$/),
        }),
        source: expect.objectContaining({
          provider: expect.any(String),
          recordId: expect.any(String),
          url: expect.any(String),
        }),
      }));
    }
  });

  // An upcoming lot and its past sales share an `itemKey`, so an item page can join them into one history.
  it('provides linked sold history and an upcoming lot for an item page', () => {
    const itemKey = 'abrabanel_commentary_example';
    const result = validateAuctionLotFixture([
      makeLot({ id: 'past-sale-1', itemKey, realizedPrice: { amount: 1100, currency: 'USD' } }),
      makeLot({ id: 'past-sale-2', itemKey, realizedPrice: { amount: 1300, currency: 'USD' } }),
      makeLot({ id: 'upcoming-1', itemKey, status: 'upcoming', realizedPrice: undefined }),
    ]);
    const upcomingLot = result.records.find((lot) => lot.status === 'upcoming' && lot.itemKey);

    expect(upcomingLot).toBeDefined();

    const linkedSales = result.records.filter((lot) =>
      lot.status === 'sold' && lot.itemKey === upcomingLot?.itemKey,
    );

    expect(linkedSales).toHaveLength(2);
    expect(new Set(linkedSales.map((sale) => sale.realizedPrice?.currency))).toEqual(new Set(['USD']));
    for (const sale of linkedSales) {
      expect(sale).toEqual(expect.objectContaining({
        saleDate: expect.any(String),
        realizedPrice: expect.objectContaining({
          amount: expect.any(Number),
          currency: expect.stringMatching(/^[A-Z]{3}$/),
        }),
        source: expect.objectContaining({
          provider: expect.any(String),
          recordId: expect.any(String),
          url: expect.any(String),
        }),
      }));
    }
  });

  // Validation passes records through untouched: their `id` and `source` lineage match the input.
  it('preserves stable IDs and source links after validation', () => {
    const input = [
      makeLot({
        id: 'lot-a',
        source: { provider: 'provider-a', recordId: 'rec-a', url: 'https://example.com/a', retrievedAt: '2025-01-01T00:00:00.000Z' },
      }),
      makeLot({
        id: 'lot-b',
        source: { provider: 'provider-b', recordId: 'rec-b', url: 'https://example.com/b', retrievedAt: '2025-01-02T00:00:00.000Z' },
      }),
    ];
    const result = validateAuctionLotFixture(input);

    expect(result.records.map((lot) => ({
      id: lot.id,
      provider: lot.source.provider,
      recordId: lot.source.recordId,
      url: lot.source.url,
    }))).toEqual(input.map((lot) => ({
      id: lot.id,
      provider: lot.source.provider,
      recordId: lot.source.recordId,
      url: lot.source.url,
    })));
  });

  it('keeps the import report safe to log', async () => {
    const result = validateAuctionLotFixture(await readCommittedFixture());
    const serializedReport = JSON.stringify(result.report).toLowerCase();

    expect(serializedReport).not.toMatch(/email|phone|bidder|consignor|verification|credential|conversation|signed/);
  });
});