import type { AuctionLot } from '@monabid/shared';
import {
  appliedRelaxations,
  relaxCriteriaForSearch,
  relaxationOptions,
  type ApprovedRelaxation,
  type RelaxableField,
  type RelaxationOption,
} from './approved-relaxation';
import type { BuyerCriteria } from './buyer-criteria';
import { BuyerSearchService } from './buyer-search.service';
import type { PaginatedSearchResult, SearchRequest } from './search-request';
import {
  createUnmatchedDemandDashboardView,
  type BuyerUnmatchedDemandDashboardView,
} from './unmatched-demand-dashboard-view';
import type { BuyerSearchRequest } from './buyer-search-request';
import {
  buildDemandSummary,
  deriveHardConstraints,
  groupExplainedLots,
  type GroupedResults,
} from './explained-results';
import { unmatchedDemandStore, type UnmatchedDemandRecorder } from './unmatched-demand.store';

// Lots-search client; today wired directly to LotsService.search() (no HTTP, so no ValidationPipe).
export interface LotsSearchClient {
  search(request: SearchRequest): Promise<PaginatedSearchResult<AuctionLot>>;
}

export interface BuyerSearchInput {
  criteria: BuyerCriteria;
  language: SearchRequest['language'];
  leadId: string;
  status: string;
  createdAt: string;
  searchedAt: string;
  // Lot the buyer picked from an earlier result set.
  selectedLotId?: string;
  // Filters the buyer explicitly agreed to drop for this search only; budget is never dropped without one.
  approvedRelaxations?: ApprovedRelaxation[];
}

// In-process progress notice, for a same-process caller (e.g. the criteria service) to relay onward; carries no lot data.
export type BuyerSearchProgress =
  | { stage: 'searching' }
  | { stage: 'results-found'; count: number }
  | { stage: 'no-results' }
  | { stage: 'insufficient-criteria' }
  | { stage: 'error' };

export type BuyerSearchOutcome =
  | {
      kind: 'results';
      searchRequest: BuyerSearchRequest;
      results: GroupedResults;
      // Filters dropped for this search with the buyer's approval, for the result cards to show as refinements.
      approvedRefinements: RelaxableField[];
      selectedLotId?: string;
    }
  | {
      kind: 'unmatched';
      view: BuyerUnmatchedDemandDashboardView;
      // Filters the buyer may choose to drop next; none is applied without approval.
      relaxationOptions: RelaxationOption[];
      selectedLotId?: string;
    }
  | {
      // Nothing searchable yet (no text and no filters): the lots search is not called and no demand is recorded.
      kind: 'insufficient-criteria';
      searchRequest: BuyerSearchRequest;
      selectedLotId?: string;
    };

// Runs lots search, then returns grouped explained results, an honest recorded no-result, or a missing-criteria state.
export class BuyerSearchOrchestrator {
  // Takes the lots-search client, the request-building service, and where no-result demand is recorded.
  constructor(
    private readonly lotsSearch: LotsSearchClient,
    private readonly buyerSearch = new BuyerSearchService(),
    private readonly demandRecorder: UnmatchedDemandRecorder = unmatchedDemandStore,
  ) {}

  // Returns grouped explained results or a privacy-safe no-result view, criteria unchanged.
  // onProgress is optional and fires only in-process (e.g. for the criteria service to relay onward); it carries no lot data.
  async search(
    input: BuyerSearchInput,
    onProgress?: (progress: BuyerSearchProgress) => void,
  ): Promise<BuyerSearchOutcome> {
    // A failing progress listener must never break the search itself.
    const notify = (progress: BuyerSearchProgress): void => {
      try {
        onProgress?.(progress);
      } catch {
        // Ignored on purpose: progress is advisory only.
      }
    };

    // The buyer's criteria and hard constraints stay as given; only this search's copy is relaxed.
    const fullRequest: BuyerSearchRequest = {
      criteria: input.criteria,
      language: input.language,
      hardConstraints:
        input.criteria.hardConstraints.length > 0
          ? input.criteria.hardConstraints
          : deriveHardConstraints(input.criteria),
    };
    const relaxed = appliedRelaxations(input.criteria, input.approvedRelaxations);
    const searchCriteria = relaxCriteriaForSearch(input.criteria, relaxed);
    const searchRequest = this.buyerSearch.createSearchRequest(searchCriteria, input.language);

    if (!searchRequest.query && !searchRequest.filters) {
      notify({ stage: 'insufficient-criteria' });
      return {
        kind: 'insufficient-criteria',
        searchRequest: fullRequest,
        selectedLotId: input.selectedLotId,
      };
    }

    notify({ stage: 'searching' });

    let items: AuctionLot[];
    try {
      ({ data: items } = await this.lotsSearch.search(searchRequest));
    } catch (error) {
      notify({ stage: 'error' });
      throw error;
    }

    if (items.length > 0) {
      notify({ stage: 'results-found', count: items.length });
      return {
        kind: 'results',
        searchRequest: fullRequest,
        // Reasons are checked against the buyer's full criteria, so a relaxed filter is never claimed as matched.
        results: groupExplainedLots(input.criteria, items),
        approvedRefinements: relaxed,
        selectedLotId: input.selectedLotId,
      };
    }

    notify({ stage: 'no-results' });
    const view = createUnmatchedDemandDashboardView({
      id: input.leadId,
      status: input.status,
      createdAt: input.createdAt,
      searchedAt: input.searchedAt,
      searchRequest: fullRequest,
      demandSummary: buildDemandSummary(input.criteria, relaxed),
    });
    await this.demandRecorder.record(view);
    return {
      kind: 'unmatched',
      view,
      relaxationOptions: relaxationOptions(searchCriteria),
      selectedLotId: input.selectedLotId,
    };
  }
}
