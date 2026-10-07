// Week 5 acceptance scenario: one supported fixture and one refusal fixture, then change a material
// fact and show a new reproducible report revision, saved per version in browser storage (a fake
// here) and compared with the previous one. Heni's real scoring, real FX fixtures, synthetic lots.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Repository } from 'typeorm';
import {
  auctionLotSchema, findPreviousSnapshot, loadValuationHistory, saveValuationSnapshot,
  type AuctionLot, type KeyValueStore,
} from '@monabid/shared';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { ComparablesService } from '../comparables/comparables.service';
import { toSellerLeadValuationSnapshot } from './dashboard-valuation';
import { ItemValuationService } from './item-valuation.service';
import { ScenarioComparisonService } from './scenario-comparison.service';
import { ValuationCalculationService } from './valuation-calculation.service';

const template = auctionLotSchema.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), '../../fixtures/auction-data/lots.json'), 'utf8'))[0]);

const lot = (id: string, text: string, amount: number): AuctionLot => auctionLotSchema.parse({
  ...template, id, category: 'paintings', status: 'sold', saleDate: '2024-03-10',
  title: { en: text }, description: { en: text }, realizedPrice: { amount, currency: 'USD' },
});

const lots = [
  lot('oil-0', 'oil on canvas portrait', 800), lot('oil-1', 'oil on canvas portrait', 1000),
  lot('oil-2', 'oil on canvas portrait', 1200), lot('water-0', 'watercolor on paper landscape', 1000),
];

const repository = {
  find: jest.fn(async () => lots.map(entry => ({ id: entry.id, payload: entry, sourceProvider: entry.source.provider,
    sourceRecordId: entry.source.recordId, createdAt: new Date(), updatedAt: new Date() }))),
} as unknown as Repository<AuctionLotEntity>;

function fakeBrowserStorage(): KeyValueStore {
  const data = new Map<string, string>();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } };
}

describe('Week 5 acceptance: a corrected fact produces a new, reproducible, comparable revision', () => {
  it('walks supported -> refusal -> supported across three item versions', async () => {
    const valuation = new ItemValuationService(new ComparablesService(repository), new ValuationCalculationService());
    const comparison = new ScenarioComparisonService();
    const storage = fakeBrowserStorage();
    const revise = async (itemVersion: string, materials: string[]) => {
      const report = await valuation.calculateFromItem({ itemId: 'item-1', itemVersion, item: { category: 'paintings', materials } });
      saveValuationSnapshot(storage, toSellerLeadValuationSnapshot(report));
      return report;
    };

    // v1: supported fixture.
    const v1 = await revise('v1', ['oil', 'canvas']);
    const v1Stored = JSON.stringify(loadValuationHistory(storage, 'item-1')[0]);
    expect(v1).toMatchObject({ status: 'supported', valuationRange: { min: 836, max: 1164 } });

    // v2: the seller corrects the material -> refusal fixture. The earlier revision is kept untouched.
    const v2 = await revise('v2', ['watercolor']);
    expect(v2).toMatchObject({ status: 'refusal', reason: 'insufficient_comparable_sales' });
    const history = loadValuationHistory(storage, 'item-1');
    expect(JSON.stringify(history[0])).toBe(v1Stored);

    // The previous revision is read back from storage and compared with the new one.
    const previousForV2 = findPreviousSnapshot(history, 'v2')!;
    expect(previousForV2.itemVersion).toBe('v1');
    expect(comparison.compare(previousForV2, history[1])).toMatchObject({
      status: 'compared', previous: { itemVersion: 'v1' }, current: { itemVersion: 'v2' },
      change: { kind: 'supported_to_refusal' },
    });

    // v3: the correct material again -> a new revision with reproducible numbers.
    const v3 = await revise('v3', ['oil', 'canvas']);
    expect(v3.reportId).not.toBe(v1.reportId);
    expect(v3).toMatchObject({ status: 'supported', valuationRange: v1.valuationRange, calculation: v1.calculation });

    const finalHistory = loadValuationHistory(storage, 'item-1');
    expect(finalHistory.map(entry => entry.itemVersion)).toEqual(['v1', 'v2', 'v3']);
    expect(comparison.compare(finalHistory[1], finalHistory[2])).toMatchObject({ change: { kind: 'refusal_to_supported' } });
    expect(comparison.compare(finalHistory[0], finalHistory[2])).toMatchObject({
      change: { kind: 'range_change', minDifference: 0, maxDifference: 0, comparableCountDifference: 0 },
    });
  });
});
