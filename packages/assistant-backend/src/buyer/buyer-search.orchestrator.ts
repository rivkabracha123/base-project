import type { AuctionLot } from '@monabid/shared';
import type { BuyerCriteria } from './buyer-criteria';
import { BuyerSearchService } from './buyer-search.service';
import type { SearchRequest } from './search-request';
import {
  createUnmatchedDemandDashboardView,
  type BuyerUnmatchedDemandDashboardView,
} from './unmatched-demand-dashboard-view';
import type { BuyerSearchRequest } from './buyer-search-request';

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
}

export type BuyerSearchOutcome =
  | { kind: 'results'; searchRequest: BuyerSearchRequest; items: AuctionLot[] }
  | { kind: 'unmatched'; view: BuyerUnmatchedDemandDashboardView };

// Converts the received buyer criteria into a typed P2 query and carries the whole criteria object - budget and every hard filter - onto the B4 results and P5 unmatched-demand handoffs, unchanged.
export class BuyerSearchOrchestrator {
  // Takes the P2 text-search dependency and the request-building service.
  constructor(
    private readonly p2: P2TextSearch,
    private readonly buyerSearch = new BuyerSearchService(),
  ) {}

  // Runs the P2 text search and returns its results or a privacy-safe no-result view, each carrying the received criteria unchanged.
  async search(input: BuyerSearchInput): Promise<BuyerSearchOutcome> {
    const searchRequest = this.buyerSearch.createSearchRequest(input.criteria, input.language);
    const items = await this.p2.searchByText(searchRequest.query, searchRequest.language);

    const fullRequest: BuyerSearchRequest = {
      criteria: input.criteria,
      language: input.language,
      hardConstraints: [],
    };

    if (items.length > 0) {
      return { kind: 'results', searchRequest: fullRequest, items };
    }

    return {
      kind: 'unmatched',
      view: createUnmatchedDemandDashboardView({
        id: input.leadId,
        status: input.status,
        createdAt: input.createdAt,
        searchedAt: input.searchedAt,
        searchRequest: fullRequest,
      }),
    };
  }
}
