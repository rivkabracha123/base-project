import type { AuctionLot } from '@monabid/shared';
import type { BuyerCriteria, Constraint } from './buyer-criteria';

/** Why one returned lot matched: a typed field plus a short detail for B4 to render. */
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

/** Honest no-result account for P5: active criteria, enforced hard constraints, no relaxation or invention. */
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

// True when the criteria carry a budget floor or ceiling.
function hasBudget(criteria: BuyerCriteria): boolean {
  return criteria.price?.min != null || criteria.price?.max != null;
}

// Strict constraints that must survive refinement; budget is always one when present.
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

// Amount to compare against the budget: realized price if known, else the estimate (raw, interim).
function comparableAmount(lot: AuctionLot): number | undefined {
  return lot.realizedPrice?.amount ?? lot.estimate?.high.amount ?? lot.estimate?.low.amount;
}

// True when the lot's comparable amount falls inside the stated budget range.
function withinBudget(criteria: BuyerCriteria, lot: AuctionLot): boolean {
  if (!hasBudget(criteria)) return false;
  const amount = comparableAmount(lot);
  if (amount == null) return false;
  const min = criteria.price?.min ?? Number.NEGATIVE_INFINITY;
  const max = criteria.price?.max ?? Number.POSITIVE_INFINITY;
  return amount >= min && amount <= max;
}

// Deterministic match reasons for one lot, emitted only when verifiable from the criteria and lot.
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

// Groups exactly the P2 lots into current (upcoming) and historical, attaching match reasons.
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
