import type { AuctionLot } from '@monabid/shared';
import type { BuyerCriteria, Constraint } from './buyer-criteria';

/**
 * Why one returned lot matches the buyer criteria. Kept as a typed field plus a
 * short detail so B4 renders the copy; B3 never produces presentation strings.
 */
export interface MatchReason {
  field: 'categories' | 'price' | 'creators' | 'keywords' | 'periods' | 'geography' | 'auctionHouseIds';
  detail: string;
}

/** A P2 result lot paired with the deterministic reasons it matched. */
export interface ExplainedLot {
  lot: AuctionLot;
  matchReasons: MatchReason[];
}

/** Results grouped for B4 as upcoming ("current") vs past sales ("historical"). */
export interface GroupedResults {
  current: ExplainedLot[];
  historical: ExplainedLot[];
}

/**
 * Honest account of a no-result search for P5: which criteria were active and
 * which hard constraints were enforced. `recovery` records that B3 neither
 * relaxed the budget nor invented inventory to produce a result.
 */
export interface DemandSummary {
  appliedCriteria: MatchReason['field'][];
  hardConstraints: Constraint[];
  recovery: 'no_relaxation_no_invention';
}

const BUDGET_REASON = 'Buyer budget is a hard limit and is not relaxed without approval';
const REQUIREMENT_REASON = 'Buyer requirement kept through refinement';

// Criteria array fields that are strict filters (keywords stay soft and are not constraints).
const CONSTRAINT_ARRAY_FIELDS = [
  'categories',
  'creators',
  'periods',
  'geography',
  'media',
  'auctionHouseIds',
] as const satisfies readonly Constraint['field'][];

function hasBudget(criteria: BuyerCriteria): boolean {
  return criteria.price?.min != null || criteria.price?.max != null;
}

/**
 * Turns the received criteria into the strict constraints that must survive
 * refinement. Budget is always a constraint when present; B3 never drops it.
 */
export function deriveHardConstraints(criteria: BuyerCriteria): Constraint[] {
  const constraints: Constraint[] = [];

  if (hasBudget(criteria)) {
    constraints.push({
      field: 'price',
      operator: 'range',
      value: criteria.price,
      reason: BUDGET_REASON,
    });
  }

  for (const field of CONSTRAINT_ARRAY_FIELDS) {
    const values = criteria[field];
    if (values.length > 0) {
      constraints.push({
        field,
        operator: 'contains',
        value: [...values],
        reason: REQUIREMENT_REASON,
      });
    }
  }

  return constraints;
}

// Lowercased text a lot exposes for deterministic substring matching.
function lotHaystack(lot: AuctionLot): string {
  return [
    lot.title.en,
    lot.title.he,
    lot.description.en,
    lot.description.he,
    lot.auctionTitle,
    lot.auctionHouse.name,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase();
}

// A single amount to compare against the budget: realized price if known,
// otherwise the estimate. Currency normalization is P2/S4's decision; the
// interim compares raw amounts and is replaced when P2's typed filter lands.
function comparableAmount(lot: AuctionLot): number | undefined {
  return lot.realizedPrice?.amount ?? lot.estimate?.high.amount ?? lot.estimate?.low.amount;
}

function withinBudget(criteria: BuyerCriteria, lot: AuctionLot): boolean {
  if (!hasBudget(criteria)) return false;
  const amount = comparableAmount(lot);
  if (amount == null) return false;
  const min = criteria.price?.min ?? Number.NEGATIVE_INFINITY;
  const max = criteria.price?.max ?? Number.POSITIVE_INFINITY;
  return amount >= min && amount <= max;
}

/**
 * Deterministic match reasons for one lot. A reason is emitted only when it can
 * be verified from the criteria and the lot data P2 returned - B3 never guesses.
 */
export function explainMatch(criteria: BuyerCriteria, lot: AuctionLot): MatchReason[] {
  const reasons: MatchReason[] = [];
  const haystack = lotHaystack(lot);

  if (criteria.categories.includes(lot.category)) {
    reasons.push({ field: 'categories', detail: lot.category });
  }

  if (withinBudget(criteria, lot)) {
    reasons.push({ field: 'price', detail: 'within the stated budget' });
  }

  for (const creator of criteria.creators) {
    if (haystack.includes(creator.toLowerCase())) {
      reasons.push({ field: 'creators', detail: creator });
    }
  }

  for (const keyword of criteria.keywords) {
    if (haystack.includes(keyword.toLowerCase())) {
      reasons.push({ field: 'keywords', detail: keyword });
    }
  }

  for (const period of criteria.periods) {
    if (haystack.includes(period.toLowerCase()) || lot.saleDate.startsWith(period)) {
      reasons.push({ field: 'periods', detail: period });
    }
  }

  for (const place of criteria.geography) {
    if (haystack.includes(place.toLowerCase())) {
      reasons.push({ field: 'geography', detail: place });
    }
  }

  if (criteria.auctionHouseIds.includes(lot.auctionHouse.id)) {
    reasons.push({ field: 'auctionHouseIds', detail: lot.auctionHouse.name });
  }

  return reasons;
}

/**
 * Groups exactly the lots P2 returned into current (upcoming) and historical
 * (any past status), attaching match reasons. B3 adds nothing P2 did not return.
 */
export function groupExplainedLots(criteria: BuyerCriteria, lots: AuctionLot[]): GroupedResults {
  const explained: ExplainedLot[] = lots.map((lot) => ({
    lot,
    matchReasons: explainMatch(criteria, lot),
  }));

  return {
    current: explained.filter((entry) => entry.lot.status === 'upcoming'),
    historical: explained.filter((entry) => entry.lot.status !== 'upcoming'),
  };
}

/** Builds the honest no-result summary handed to P5. */
export function buildDemandSummary(criteria: BuyerCriteria): DemandSummary {
  const applied: MatchReason['field'][] = [];
  if (hasBudget(criteria)) applied.push('price');
  if (criteria.categories.length > 0) applied.push('categories');
  if (criteria.creators.length > 0) applied.push('creators');
  if (criteria.periods.length > 0) applied.push('periods');
  if (criteria.geography.length > 0) applied.push('geography');
  if (criteria.auctionHouseIds.length > 0) applied.push('auctionHouseIds');
  if (criteria.keywords.length > 0) applied.push('keywords');

  return {
    appliedCriteria: applied,
    hardConstraints: deriveHardConstraints(criteria),
    recovery: 'no_relaxation_no_invention',
  };
}
