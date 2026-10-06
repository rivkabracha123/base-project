import type { AuctionLot } from '@monabid/shared';
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

// P2 lots-search client; today wired directly to LotsService.search() (no HTTP, so no ValidationPipe).
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
}

// In-process progress notice, for a same-process caller (e.g. B2) to relay onward; carries no lot data.
export type BuyerSearchProgress =
  | { stage: 'searching' }
  | { stage: 'results-found'; count: number }
  | { stage: 'no-results' }
  | { stage: 'error' };

export type BuyerSearchOutcome =
  | {
      kind: 'results';
      searchRequest: BuyerSearchRequest;
      results: GroupedResults;
      selectedLotId?: string;
    }
  | {
      kind: 'unmatched';
      view: BuyerUnmatchedDemandDashboardView;
      selectedLotId?: string;
    };

// Runs lots search, then returns grouped explained results or an honest no-result summary.
export class BuyerSearchOrchestrator {
  // Takes the lots-search client and the request-building service.
  constructor(
    private readonly lotsSearch: LotsSearchClient,
    private readonly buyerSearch = new BuyerSearchService(),
  ) {}

  // Returns grouped explained results or a privacy-safe no-result view, criteria unchanged.
  // onProgress is optional and fires only in-process (e.g. for B2 to relay onward); it carries no lot data.
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

    notify({ stage: 'searching' });

    const searchRequest = this.buyerSearch.createSearchRequest(input.criteria, input.language);
    let items: AuctionLot[];
    try {
      ({ data: items } = await this.lotsSearch.search(searchRequest));
    } catch (error) {
      notify({ stage: 'error' });
      throw error;
    }

    const fullRequest: BuyerSearchRequest = {
      criteria: input.criteria,
      language: input.language,
      hardConstraints:
        input.criteria.hardConstraints.length > 0
          ? input.criteria.hardConstraints
          : deriveHardConstraints(input.criteria),
    };

    if (items.length > 0) {
      notify({ stage: 'results-found', count: items.length });
      return {
        kind: 'results',
        searchRequest: fullRequest,
        results: groupExplainedLots(input.criteria, items),
        selectedLotId: input.selectedLotId,
      };
    }

    notify({ stage: 'no-results' });
    return {
      kind: 'unmatched',
      view: createUnmatchedDemandDashboardView({
        id: input.leadId,
        status: input.status,
        createdAt: input.createdAt,
        searchedAt: input.searchedAt,
        searchRequest: fullRequest,
        demandSummary: buildDemandSummary(input.criteria),
      }),
      selectedLotId: input.selectedLotId,
    };
  }
}
