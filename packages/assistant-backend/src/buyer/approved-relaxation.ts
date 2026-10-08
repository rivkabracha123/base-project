import type { BuyerCriteria } from './buyer-criteria';
import type { SearchFilters } from './search-request';

/** A lots-search filter the buyer may explicitly agree to drop for one search. */
export type RelaxableField = keyof SearchFilters;

/** The buyer's explicit consent to drop one filter; without it nothing is relaxed. */
export interface ApprovedRelaxation {
  field: RelaxableField;
  approvedAt: string;
}

/** A filter the orchestrator may offer to drop after a no-result; never applied until the buyer approves it. */
export interface RelaxationOption {
  field: RelaxableField;
  requiresApproval: true;
}

const BUDGET_FIELD: RelaxableField = 'price';

// Fixed order so options and applied relaxations stay deterministic; budget is offered last.
const RELAXABLE_FIELDS: readonly RelaxableField[] = [
  'dateRange',
  'auctionHouseIds',
  'creators',
  'categories',
  BUDGET_FIELD,
];

// True when the criteria actually send this filter to the lots search.
function isActive(criteria: BuyerCriteria, field: RelaxableField): boolean {
  switch (field) {
    case 'price':
      return criteria.price?.min != null || criteria.price?.max != null;
    case 'dateRange':
      return Boolean(criteria.dateRange?.from || criteria.dateRange?.to);
    default:
      return criteria[field].length > 0;
  }
}

// Filters the buyer could choose to drop after a no-result, each needing explicit approval.
export function relaxationOptions(criteria: BuyerCriteria): RelaxationOption[] {
  return RELAXABLE_FIELDS.filter((field) => isActive(criteria, field)).map((field) => ({
    field,
    requiresApproval: true,
  }));
}

// Approved fields that are active in the criteria, in fixed order; unapproved or inactive fields are ignored.
export function appliedRelaxations(
  criteria: BuyerCriteria,
  approvals: readonly ApprovedRelaxation[] = [],
): RelaxableField[] {
  const approved = new Set(approvals.map((approval) => approval.field));
  return RELAXABLE_FIELDS.filter((field) => approved.has(field) && isActive(criteria, field));
}

// Copy of the criteria for this one search with only the approved filters dropped; the original is untouched.
export function relaxCriteriaForSearch(
  criteria: BuyerCriteria,
  relaxed: readonly RelaxableField[],
): BuyerCriteria {
  const searchCriteria: BuyerCriteria = { ...criteria };
  for (const field of relaxed) {
    if (field === 'price' || field === 'dateRange') delete searchCriteria[field];
    else searchCriteria[field] = [];
  }
  return searchCriteria;
}
