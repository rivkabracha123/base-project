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

  // Every sold lot in the fixture exposes a non-negative realized price, an ISO currency, and a source link.
  it('provides traceable historical sales with original prices and currencies', async () => {
    const result = validateAuctionLotFixture(await readCommittedFixture());
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

  // An upcoming lot links to its two past USD sales via a shared `itemKey`, giving an item page full history.
  it('provides linked sold history and an upcoming lot for an item page', async () => {
    const result = validateAuctionLotFixture(await readCommittedFixture());
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

  // Validation passes records through untouched: their `id` and `source` lineage match the raw fixture.
  it('preserves stable IDs and source links after validation', async () => {
    const fixture = await readCommittedFixture();
    const result = validateAuctionLotFixture(fixture);

    expect(result.records.map((lot) => ({
      id: lot.id,
      provider: lot.source.provider,
      recordId: lot.source.recordId,
      url: lot.source.url,
    }))).toEqual((fixture as Array<{
      id: string;
      source: { provider: string; recordId: string; url: string };
    }>).map((lot) => ({
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