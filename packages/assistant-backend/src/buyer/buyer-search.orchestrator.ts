import type { AuctionLot } from '@monabid/shared';
import type { BuyerCriteria } from './buyer-criteria';
import { BuyerSearchService } from './buyer-search.service';
import type { SearchRequest } from './search-request';
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

export interface P2TextSearch {
  searchByText(query: string, language: SearchRequest['language']): Promise<AuctionLot[]>;
}

export interface BuyerSearchInput {
  criteria: BuyerCriteria;
  language: SearchRequest['language'];
  leadId: string;
  status: string;
  createdAt: string;
  searchedAt: string;
  /** Lot the buyer picked from an earlier result set, carried through to B4/P5. */
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

// Converts the received buyer criteria into a typed P2 query, then hands B4 the
// P2 results grouped as current/historical with deterministic match reasons, or
// hands P5 an honest no-result summary. The whole criteria object and its
// derived hard constraints - budget included - are carried through unchanged.
export class BuyerSearchOrchestrator {
  // Takes the P2 text-search dependency and the request-building service.
  constructor(
    private readonly p2: P2TextSearch,
    private readonly buyerSearch = new BuyerSearchService(),
  ) {}

  // Runs the P2 text search and returns grouped, explained results or a
  // privacy-safe no-result view, each carrying the received criteria unchanged.
  async search(input: BuyerSearchInput): Promise<BuyerSearchOutcome> {
    const searchRequest = this.buyerSearch.createSearchRequest(input.criteria, input.language);
    const items = await this.p2.searchByText(searchRequest.query, searchRequest.language);

    const fullRequest: BuyerSearchRequest = {
      criteria: input.criteria,
      language: input.language,
      hardConstraints: deriveHardConstraints(input.criteria),
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
