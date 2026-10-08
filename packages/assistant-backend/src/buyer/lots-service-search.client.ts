import { Injectable } from '@nestjs/common';
import { LotsService } from '../lots/lots.service';
import type { LotsSearchClient } from './buyer-search.orchestrator';
import type { LotSearchResult } from '../lots/lot-match';
import type { SearchRequest } from './search-request';

const DEFAULT_SEARCH_LIMIT = 50;

/** POST /api/lots/search via LotsService (P2). */
@Injectable()
export class LotsServiceSearchClient implements LotsSearchClient {
  constructor(private readonly lots: LotsService) {}

  async search(request: SearchRequest): Promise<LotSearchResult> {
    return this.lots.search({
      query: request.query,
      language: request.language,
      page: 1,
      limit: DEFAULT_SEARCH_LIMIT,
      filters: request.filters,
    });
  }
}
