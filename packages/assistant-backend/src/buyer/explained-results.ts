import type { DemandSummary, ExplainedLot, GroupedResults, MatchReasonField, RelaxableField } from '@monabid/shared';
import type { BuyerCriteria, Constraint } from './buyer-criteria';
import { CONVERTED_CRITERIA, searchableValues } from './criteria-to-search-request';

export type { DemandSummary, ExplainedLot, GroupedResults };
export type { MatchReason } from '@monabid/shared';

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

// Groups exactly the returned matches into current (upcoming) and historical, keeping the lots search's order and reasons.
export function groupExplainedLots(explained: ExplainedLot[]): GroupedResults {
  return {
    current: explained.filter((entry) => entry.lot.status === 'upcoming'),
    historical: explained.filter((entry) => entry.lot.status !== 'upcoming'),
  };
}

/** Builds the honest no-result summary handed to the staff dashboard; lists only criteria actually sent to the lots search, after approved relaxation. */
export function buildDemandSummary(
  criteria: BuyerCriteria,
  relaxedFields: readonly RelaxableField[] = [],
): DemandSummary {
  const relaxed = new Set(relaxedFields);
  const applied: MatchReasonField[] = [];
  if (hasBudget(criteria) && !relaxed.has('price')) applied.push('price');
  if (criteria.categories.length > 0 && !relaxed.has('categories')) applied.push('categories');
  if (criteria.creators.length > 0 && !relaxed.has('creators')) applied.push('creators');
  if (criteria.auctionHouseIds.length > 0 && !relaxed.has('auctionHouseIds')) applied.push('auctionHouseIds');
  for (const field of CONVERTED_CRITERIA) {
    if (searchableValues(criteria, field).length > 0 && !relaxed.has(field)) applied.push(field);
  }
  if (criteria.keywords.length > 0) applied.push('query');

  // Hard constraints are the buyer's own and stay intact even when one search ran without them.
  return {
    appliedCriteria: applied,
    hardConstraints: deriveHardConstraints(criteria),
    ...(relaxedFields.length > 0
      ? { recovery: 'approved_relaxation_no_invention' as const, relaxedFields: [...relaxedFields] }
      : { recovery: 'no_relaxation_no_invention' as const }),
  };
}
