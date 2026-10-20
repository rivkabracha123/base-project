import type {
  BuyerSearchRequest,
  BuyerUnmatchedDemandDashboardView,
  DemandChangedField,
  DemandSummary,
  RelaxableField,
} from '@monabid/shared';

export type { BuyerUnmatchedDemandDashboardView };

export interface UnmatchedDemandDashboardInput {
  id: string;
  status: string;
  createdAt: string;
  searchedAt: string;
  searchRequest: BuyerSearchRequest;
  demandSummary: DemandSummary;
}

/** A later search for a lead that already has recorded demand and this time found lots. */
export interface FoundLaterSearch {
  leadId: string;
  searchRequest: BuyerSearchRequest;
  relaxedFields: RelaxableField[];
  searchedAt: string;
  resultCount: number;
}

const CHANGEABLE_FIELDS: DemandChangedField[] = [
  'categories',
  'creators',
  'periods',
  'media',
  'keywords',
  'geography',
  'auctionHouseIds',
  'dateRange',
  'price',
];

/** Wraps a no-result search as a dashboard view without private data. */
export function createUnmatchedDemandDashboardView(input: UnmatchedDemandDashboardInput): BuyerUnmatchedDemandDashboardView {
  return {
    id: input.id,
    type: 'buyer',
    status: input.status,
    createdAt: input.createdAt,
    unmatchedDemand: {
      searchRequest: input.searchRequest,
      reason: 'no_results',
      searchedAt: input.searchedAt,
      demandSummary: input.demandSummary,
    },
  };
}

// Lists the criteria fields whose values differ between the original request and a later one.
export function changedCriteriaFields(original: BuyerSearchRequest, later: BuyerSearchRequest): DemandChangedField[] {
  return CHANGEABLE_FIELDS.filter(
    (field) => JSON.stringify(original.criteria[field] ?? null) !== JSON.stringify(later.criteria[field] ?? null),
  );
}

// Records a no-result search: the first one is the original request; a later one is kept as the buyer's expansion.
export function withNoResultSearch(
  existing: BuyerUnmatchedDemandDashboardView | undefined,
  view: BuyerUnmatchedDemandDashboardView,
): BuyerUnmatchedDemandDashboardView {
  if (!existing) return view;
  const original = existing.unmatchedDemand;
  const later = view.unmatchedDemand;
  const changedFields = changedCriteriaFields(original.searchRequest, later.searchRequest);
  const relaxedFields = later.demandSummary.relaxedFields ?? [];
  // The same request searched again adds nothing for staff.
  if (changedFields.length === 0 && relaxedFields.length === 0) return existing;
  return {
    ...existing,
    status: view.status,
    unmatchedDemand: {
      ...original,
      expansion: {
        searchRequest: later.searchRequest,
        changedFields,
        ...(relaxedFields.length > 0 ? { relaxedFields } : {}),
        searchedAt: later.searchedAt,
        outcome: 'no_results',
      },
    },
  };
}

// Marks recorded demand whose later search found lots, keeping the original request for staff.
export function withFoundSearch(
  existing: BuyerUnmatchedDemandDashboardView,
  found: FoundLaterSearch,
): BuyerUnmatchedDemandDashboardView {
  const original = existing.unmatchedDemand;
  return {
    ...existing,
    unmatchedDemand: {
      ...original,
      expansion: {
        searchRequest: found.searchRequest,
        changedFields: changedCriteriaFields(original.searchRequest, found.searchRequest),
        ...(found.relaxedFields.length > 0 ? { relaxedFields: [...found.relaxedFields] } : {}),
        searchedAt: found.searchedAt,
        outcome: 'results',
        resultCount: found.resultCount,
      },
    },
  };
}

// Time of the lead's most recent search, original or later, for ordering staff lists.
export function latestSearchedAt(view: BuyerUnmatchedDemandDashboardView): string {
  return view.unmatchedDemand.expansion?.searchedAt ?? view.unmatchedDemand.searchedAt;
}
