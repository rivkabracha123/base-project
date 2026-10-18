// S3 -> S4 flow: Heni's real ComparablesService (fake lot repository) feeding the real S4 calculation
// through ItemValuationService.calculateFromItem. Synthetic FX rates only; no database or network.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Repository } from 'typeorm';
import { auctionLotSchema, type AuctionLot, type ComparableEvidence } from '@monabid/shared';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { ComparablesService } from '../comparables/comparables.service';
import { mapEvidenceToValuationInput, WITHHELD_REASON } from './comparable-evidence.mapper';
import { ItemValuationService } from './item-valuation.service';
import { ValuationCalculationService } from './valuation-calculation.service';

jest.mock('./valuation-calculation.fixtures', () => ({
  USD_EXCHANGE_RATE_FIXTURES: jest.requireActual('./fx-range.fixtures').syntheticUsdRates,
}));

const makeEntity = (lot: AuctionLot): AuctionLotEntity => ({
  id: lot.id, payload: lot, sourceProvider: lot.source.provider, sourceRecordId: lot.source.recordId,
  createdAt: new Date(), updatedAt: new Date(),
});

function lotsFor(amounts: Array<number | undefined>): AuctionLot[] {
  const fixture = JSON.parse(readFileSync(resolve(process.cwd(), '../../fixtures/auction-data/lots.json'), 'utf8'));
  const template = auctionLotSchema.parse(fixture[0]);
  return amounts.map((amount, index) => auctionLotSchema.parse({
    ...template, id: `flow-${index}`, category: 'furniture', saleDate: '2024-03-10',
    status: amount === undefined ? 'unsold' : 'sold',
    realizedPrice: amount === undefined ? undefined : { amount, currency: 'USD' },
  }));
}

function serviceFor(lots: AuctionLot[]): ItemValuationService {
  const repository = { find: jest.fn().mockResolvedValue(lots.map(makeEntity)) } as unknown as Repository<AuctionLotEntity>;
  return new ItemValuationService(new ComparablesService(repository), new ValuationCalculationService());
}

const request = { itemId: 'item-1', itemVersion: 'v2', item: { category: 'furniture' } };

describe('ItemValuationService.calculateFromItem (S3 -> S4 flow)', () => {
  it('turns S3 comparable evidence into a supported USD range', async () => {
    const report = await serviceFor(lotsFor([800, 1000, 1200, undefined])).calculateFromItem(request);

    // Same equal-weight range as the contract example in fx-range.contract.spec.ts.
    expect(report).toMatchObject({ status: 'supported', comparableCount: 3,
      valuationRange: { min: 836, max: 1164, currency: 'USD' } });
    expect(report.excludedComparableIds).toContain('flow-3');
  });

  it('carries the caller itemId and itemVersion into the report', async () => {
    const report = await serviceFor(lotsFor([800, 1000, 1200])).calculateFromItem(request);

    expect(report).toMatchObject({ itemId: 'item-1', itemVersion: 'v2' });
  });

  it('uses rare-book sales when intake has no confirmed materials instead of demo painting materials', async () => {
    const rareBookSales = lotsFor([800, 1000, 1200]).map(lot => ({ ...lot, category: 'rare_books' }));
    const cleanItem = await serviceFor(rareBookSales).calculateFromItem({
      itemId: 'manuscript-1',
      itemVersion: 'v1',
      item: { category: 'rare_books', materials: [] },
    });
    const contaminatedItem = await serviceFor(rareBookSales).calculateFromItem({
      itemId: 'manuscript-2',
      itemVersion: 'v1',
      item: { category: 'rare_books', materials: ['oil', 'canvas'] },
    });

    expect(cleanItem).toMatchObject({ status: 'supported', comparableCount: 3 });
    expect(contaminatedItem).toMatchObject({ status: 'refusal', reason: 'insufficient_comparable_sales' });
  });

  it('refuses without a range when S3 supplies fewer than three credible sales', async () => {
    const report = await serviceFor(lotsFor([800, 1000, undefined])).calculateFromItem(request);

    expect(report).toMatchObject({ status: 'refusal', reason: 'insufficient_comparable_sales' });
    expect(report).not.toHaveProperty('valuationRange');
  });
});

describe('mapEvidenceToValuationInput', () => {
  async function evidence(): Promise<ComparableEvidence> {
    return new ComparablesService({
      find: jest.fn().mockResolvedValue(lotsFor([800, 1000, 1200, undefined]).map(makeEntity)),
    } as unknown as Repository<AuctionLotEntity>).findComparables({ category: 'furniture' });
  }

  it('maps score to weight and realizedPrice to soldPrice, keeping S3 exclusion reasons', async () => {
    const source = await evidence();
    const mapped = mapEvidenceToValuationInput(source, 'item-1', 'v2');

    expect(mapped.comparables).toHaveLength(3);
    expect(mapped.comparables[0]).toMatchObject({ status: 'sold', currency: 'USD', weight: source.included[0]!.score });
    expect(mapped.excludedComparables).toEqual([{ id: 'flow-3', reason: source.excluded[0]!.exclusionReason }]);
  });

  it('excludes an included lot that has no realized price instead of throwing', async () => {
    const source = await evidence();
    delete source.included[0]!.lot.realizedPrice;

    const mapped = mapEvidenceToValuationInput(source, 'item-1', 'v2');

    expect(mapped.comparables).toHaveLength(2);
    expect(mapped.excludedComparables).toContainEqual({ id: source.included[0]!.lot.id, reason: 'missing_realized_price' });
  });

  it('withholds an exclusion reason that looks like contact data and keeps ordinary reasons', async () => {
    const source = await evidence();
    source.excluded[0]!.exclusionReason = 'see seller at someone@example.com or +972 50 123 4567';
    source.included.pop();
    const lastIncluded = source.included[source.included.length - 1]!;
    source.excluded.push({ ...lastIncluded, included: false, exclusionReason: "Category does not match — 'furniture' is not 'paintings'" });

    const mapped = mapEvidenceToValuationInput(source, 'item-1', 'v2');

    expect(mapped.excludedComparables![0]!.reason).toBe(WITHHELD_REASON);
    expect(mapped.excludedComparables![1]!.reason).toBe("Category does not match — 'furniture' is not 'paintings'");
    expect(JSON.stringify(mapped)).not.toMatch(/example\.com|972/);
  });

  it('does not mutate the evidence it receives', async () => {
    const source = await evidence();
    const before = JSON.parse(JSON.stringify(source));

    mapEvidenceToValuationInput(source, 'item-1', 'v2');

    expect(source).toEqual(before);
  });
});
