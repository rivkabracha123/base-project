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
  | { kind: 'results'; searchRequest: SearchRequest; items: AuctionLot[] }
  | { kind: 'unmatched'; view: BuyerUnmatchedDemandDashboardView };

/** Orchestrates the Week 2 buyer request through P2 and the downstream handoffs. */
export class BuyerSearchOrchestrator {
  constructor(
    private readonly p2: P2TextSearch,
    private readonly buyerSearch = new BuyerSearchService(),
  ) {}

  /** Returns fixture-backed results or a privacy-safe P5 no-result view. */
  async search(input: BuyerSearchInput): Promise<BuyerSearchOutcome> {
    const searchRequest = this.buyerSearch.createSearchRequest(input.criteria, input.language);
    const items = await this.p2.searchByText(searchRequest.query, searchRequest.language);

    if (items.length > 0) {
      return { kind: 'results', searchRequest, items };
    }

    const fullRequest: BuyerSearchRequest = {
      criteria: input.criteria,
      language: input.language,
      hardConstraints: [],
    };

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
