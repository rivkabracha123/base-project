import { describe, expect, it } from 'vitest';
import type { SellerLeadValuationSnapshot } from './dashboard-valuation';
import {
  compareValuations,
  findPreviousSnapshot,
  loadValuationHistory,
  saveValuationSnapshot,
  type KeyValueStore,
} from './valuation-history';

// Synthetic fixtures only.
function fakeStore(initial: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } };
}

const comparable = (id: string) => ({
  id, source: { label: 'Source unavailable', url: null }, saleDate: '2024-03-10',
  originalPrice: 1000, originalCurrency: 'USD', normalizedPrice: 1000, weight: 1,
});

function supported(reportId: string, itemVersion: string, min: number, max: number, itemId = 'item-1'): SellerLeadValuationSnapshot {
  return {
    itemId, itemVersion, calculationVersion: 'weighted-usd-population-sd-v1',
    dashboard: {
      status: 'supported', reportId, comparableCount: 3, limitations: ['Synthetic.'],
      comparables: [comparable('a'), comparable('b'), comparable('c')], excludedComparables: [],
      valuationRange: { min, max, currency: 'USD' }, confidence: { level: 'low', explanation: 'Synthetic.' },
    },
  };
}

function refusal(reportId: string, itemVersion: string, itemId = 'item-1'): SellerLeadValuationSnapshot {
  return {
    itemId, itemVersion, calculationVersion: 'weighted-usd-population-sd-v1',
    dashboard: {
      status: 'refusal', reportId, reason: 'insufficient_comparable_sales', comparableCount: 1,
      limitations: ['Synthetic.'], comparables: [comparable('a')], excludedComparables: [],
    },
  };
}

describe('saving and loading revisions', () => {
  it('stores a revision and reads it back unchanged', () => {
    const store = fakeStore();
    const snapshot = supported('r1', 'v1', 900, 1100);

    saveValuationSnapshot(store, snapshot);

    expect(loadValuationHistory(store, 'item-1')).toEqual([snapshot]);
  });

  it('keeps earlier revisions byte-identical when a new version is saved', () => {
    const store = fakeStore();
    saveValuationSnapshot(store, supported('r1', 'v1', 900, 1100));
    const before = store.getItem('monabid.valuation.item-1')!;

    saveValuationSnapshot(store, supported('r2', 'v2', 950, 1150));

    const history = loadValuationHistory(store, 'item-1');
    expect(history.map(entry => entry.dashboard.reportId)).toEqual(['r1', 'r2']);
    expect(JSON.stringify(history.slice(0, 1))).toBe(JSON.stringify(JSON.parse(before)));
  });

  it('does not duplicate the same report when it is saved twice', () => {
    const store = fakeStore();
    const snapshot = supported('r1', 'v1', 900, 1100);

    saveValuationSnapshot(store, snapshot);
    saveValuationSnapshot(store, snapshot);

    expect(loadValuationHistory(store, 'item-1')).toHaveLength(1);
  });

  it('keeps separate histories for different items', () => {
    const store = fakeStore();
    saveValuationSnapshot(store, supported('r1', 'v1', 900, 1100, 'item-1'));
    saveValuationSnapshot(store, supported('r2', 'v1', 500, 700, 'item-2'));

    expect(loadValuationHistory(store, 'item-1')).toHaveLength(1);
    expect(loadValuationHistory(store, 'item-2')[0]!.dashboard.reportId).toBe('r2');
  });

  it('rejects an invalid snapshot instead of storing it', () => {
    const store = fakeStore();
    const invalid = { ...supported('r1', 'v1', 900, 1100), itemId: '' } as SellerLeadValuationSnapshot;

    expect(() => saveValuationSnapshot(store, invalid)).toThrow();
    expect(store.data.size).toBe(0);
  });

  it('surfaces a storage failure instead of hiding it', () => {
    const failing: KeyValueStore = { getItem: () => null, setItem: () => { throw new Error('quota exceeded'); } };

    expect(() => saveValuationSnapshot(failing, supported('r1', 'v1', 900, 1100))).toThrow('quota exceeded');
  });
});

describe('reading untrusted browser storage', () => {
  it.each([
    ['missing key', {}],
    ['corrupted JSON', { 'monabid.valuation.item-1': '{not json' }],
    ['not an array', { 'monabid.valuation.item-1': '{"a":1}' }],
  ])('returns an empty history for %s', (_name, initial) => {
    expect(loadValuationHistory(fakeStore(initial), 'item-1')).toEqual([]);
  });

  it('ignores invalid entries and entries that belong to another item', () => {
    const good = supported('r1', 'v1', 900, 1100);
    const stored = JSON.stringify([
      good, { itemId: 'item-1', nonsense: true }, supported('r9', 'v1', 1, 2, 'item-2'),
    ]);

    const history = loadValuationHistory(fakeStore({ 'monabid.valuation.item-1': stored }), 'item-1');

    expect(history).toEqual([good]);
  });
});

describe('findPreviousSnapshot', () => {
  it('returns the latest revision of a different version, and nothing when there is none', () => {
    const v1 = supported('r1', 'v1', 900, 1100);
    const v2 = supported('r2', 'v2', 950, 1150);

    expect(findPreviousSnapshot([v1, v2], 'v2')).toBe(v1);
    expect(findPreviousSnapshot([v1], 'v1')).toBeUndefined();
    expect(findPreviousSnapshot([], 'v1')).toBeUndefined();
  });
});

describe('compareValuations', () => {
  it('reports hand-calculated differences between two supported revisions', () => {
    const result = compareValuations(supported('r1', 'v1', 900, 1100), supported('r2', 'v2', 950, 1250));

    expect(result).toMatchObject({
      status: 'compared', itemId: 'item-1',
      previous: { reportId: 'r1', itemVersion: 'v1', valuationRange: { min: 900, max: 1100 } },
      current: { reportId: 'r2', itemVersion: 'v2', valuationRange: { min: 950, max: 1250 } },
      change: { kind: 'range_change', minDifference: 50, maxDifference: 150, comparableCountDifference: 0 },
    });
  });

  it('does not invent numeric differences for supported to refusal', () => {
    const result = compareValuations(supported('r1', 'v1', 900, 1100), refusal('r2', 'v2'));

    expect(result).toMatchObject({ status: 'compared', change: { kind: 'supported_to_refusal' },
      current: { status: 'refusal', refusalReason: 'insufficient_comparable_sales' } });
    expect(JSON.stringify(result)).not.toContain('Difference');
  });

  it('does not invent numeric differences for refusal to supported', () => {
    const result = compareValuations(refusal('r1', 'v1'), supported('r2', 'v2', 900, 1100));

    expect(result).toMatchObject({ change: { kind: 'refusal_to_supported' }, previous: { status: 'refusal' } });
    expect(JSON.stringify(result)).not.toContain('Difference');
  });

  it('does not invent numeric differences for refusal to refusal', () => {
    const result = compareValuations(refusal('r1', 'v1'), refusal('r2', 'v2'));

    expect(result).toMatchObject({ change: { kind: 'both_refusal' } });
  });

  it('reports revisions of different items as incompatible', () => {
    const result = compareValuations(supported('r1', 'v1', 900, 1100, 'item-1'), supported('r2', 'v1', 900, 1100, 'item-2'));

    expect(result).toEqual({ status: 'incompatible', reason: 'different_item' });
  });

  it('does not change either input', () => {
    const previous = supported('r1', 'v1', 900, 1100);
    const current = supported('r2', 'v2', 950, 1250);
    const before = JSON.stringify([previous, current]);

    compareValuations(previous, current);

    expect(JSON.stringify([previous, current])).toBe(before);
  });
});
