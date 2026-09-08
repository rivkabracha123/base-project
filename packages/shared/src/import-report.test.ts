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

  it('keeps the import report safe to log', async () => {
    const result = validateAuctionLotFixture(await readCommittedFixture());
    const serializedReport = JSON.stringify(result.report).toLowerCase();

    expect(serializedReport).not.toMatch(/email|phone|bidder|consignor|verification|credential|conversation|signed/);
  });
});