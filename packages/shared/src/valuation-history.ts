import { sellerLeadValuationSnapshotSchema, type SellerLeadValuationSnapshot } from './dashboard-valuation';

// S4 Week 5: keep each valuation report revision per item version in browser storage, read the
// previous one back, and compare two revisions. Browser storage is passed in (localStorage in the
// browser, a fake in tests), so this module has no DOM dependency and never touches storage itself.

/** The subset of the browser Storage interface this module needs. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const VALUATION_HISTORY_KEY_PREFIX = 'monabid.valuation.';
const historyKey = (itemId: string) => `${VALUATION_HISTORY_KEY_PREFIX}${itemId}`;

/**
 * Reads every stored revision for an item, in the order they were saved. Browser storage is
 * untrusted (users and other code can change it), so each entry is validated against the shared
 * schema and anything invalid, or belonging to another item, is ignored rather than trusted.
 */
export function loadValuationHistory(store: KeyValueStore, itemId: string): SellerLeadValuationSnapshot[] {
  let parsed: unknown;
  try {
    const raw = store.getItem(historyKey(itemId));
    if (raw === null) return [];
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap(entry => {
    const result = sellerLeadValuationSnapshotSchema.safeParse(entry);
    return result.success && result.data.itemId === itemId ? [result.data] : [];
  });
}

/**
 * Appends a revision to the item's history. Existing revisions are never changed or removed, and
 * saving the same report twice (same reportId) does not duplicate it. An invalid snapshot throws,
 * and a storage failure (for example a full quota) is surfaced rather than hidden.
 */
export function saveValuationSnapshot(
  store: KeyValueStore,
  snapshot: SellerLeadValuationSnapshot,
): SellerLeadValuationSnapshot[] {
  const valid = sellerLeadValuationSnapshotSchema.parse(snapshot);
  const history = loadValuationHistory(store, valid.itemId);
  if (history.some(entry => entry.dashboard.reportId === valid.dashboard.reportId)) return history;
  const updated = [...history, valid];
  store.setItem(historyKey(valid.itemId), JSON.stringify(updated));
  return updated;
}

/** The most recently saved revision of a different item version than the current one. */
export function findPreviousSnapshot(
  history: SellerLeadValuationSnapshot[],
  currentVersion: string,
): SellerLeadValuationSnapshot | undefined {
  return [...history].reverse().find(entry => entry.itemVersion !== currentVersion);
}

type ComparedSide = {
  reportId: string;
  itemVersion: string;
  status: 'supported' | 'refusal';
  comparableCount: number;
  valuationRange?: { min: number; max: number; currency: 'USD' };
  confidenceLevel?: 'low' | 'medium' | 'high';
  refusalReason?: string;
};

export type ValuationComparison =
  | { status: 'incompatible'; reason: 'different_item' }
  | {
    status: 'compared';
    itemId: string;
    previous: ComparedSide;
    current: ComparedSide;
    // Numeric differences exist only when both revisions have a range; never invented otherwise.
    change:
      | { kind: 'range_change'; minDifference: number; maxDifference: number; comparableCountDifference: number }
      | { kind: 'supported_to_refusal' }
      | { kind: 'refusal_to_supported' }
      | { kind: 'both_refusal' };
  };

function sideOf(snapshot: SellerLeadValuationSnapshot): ComparedSide {
  const { dashboard } = snapshot;
  const base = { reportId: dashboard.reportId, itemVersion: snapshot.itemVersion, comparableCount: dashboard.comparableCount };
  return dashboard.status === 'supported'
    ? { ...base, status: 'supported', valuationRange: { ...dashboard.valuationRange }, confidenceLevel: dashboard.confidence.level }
    : { ...base, status: 'refusal', refusalReason: dashboard.reason };
}

/**
 * Compares two revisions. Both are validated first. Different items are reported as incompatible
 * rather than compared. The differences are current minus previous.
 */
export function compareValuations(
  previous: SellerLeadValuationSnapshot,
  current: SellerLeadValuationSnapshot,
): ValuationComparison {
  const before = sellerLeadValuationSnapshotSchema.parse(previous);
  const after = sellerLeadValuationSnapshotSchema.parse(current);
  if (before.itemId !== after.itemId) return { status: 'incompatible', reason: 'different_item' };

  const [previousSide, currentSide] = [sideOf(before), sideOf(after)];
  const range = (side: ComparedSide) => side.valuationRange;
  const change = range(previousSide) && range(currentSide)
    ? {
      kind: 'range_change' as const,
      minDifference: range(currentSide)!.min - range(previousSide)!.min,
      maxDifference: range(currentSide)!.max - range(previousSide)!.max,
      comparableCountDifference: currentSide.comparableCount - previousSide.comparableCount,
    }
    : previousSide.status === 'supported' ? { kind: 'supported_to_refusal' as const }
      : currentSide.status === 'supported' ? { kind: 'refusal_to_supported' as const }
        : { kind: 'both_refusal' as const };

  return { status: 'compared', itemId: after.itemId, previous: previousSide, current: currentSide, change };
}
