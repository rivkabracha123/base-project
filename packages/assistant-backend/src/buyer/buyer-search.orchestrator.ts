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

/** Client for POST /api/lots/search (LotsService.search). */
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
  /** Lot the buyer picked from an earlier result set. */
  selectedLotId?: string;
}

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

/** Runs lots search, then returns grouped explained results or an honest no-result summary. */
export class BuyerSearchOrchestrator {
  constructor(
    private readonly lotsSearch: LotsSearchClient,
    private readonly buyerSearch = new BuyerSearchService(),
  ) {}

  // Returns grouped explained results or a privacy-safe no-result view, criteria unchanged.
  async search(input: BuyerSearchInput): Promise<BuyerSearchOutcome> {
    const searchRequest = this.buyerSearch.createSearchRequest(input.criteria, input.language);
    const { data: items } = await this.lotsSearch.search(searchRequest);

    const fullRequest: BuyerSearchRequest = {
      criteria: input.criteria,
      language: input.language,
      hardConstraints:
        input.criteria.hardConstraints.length > 0
          ? input.criteria.hardConstraints
          : deriveHardConstraints(input.criteria),
    };

    if (items.length > 0) {
      return {
        kind: 'results',
        searchRequest: fullRequest,
        results: groupExplainedLots(input.criteria, items),
        selectedLotId: input.selectedLotId,
      };
    }

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
