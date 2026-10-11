import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuctionLot } from '@monabid/shared';
import type { LotsSearchClient } from './buyer-search.orchestrator';
import type { PaginatedSearchResult, SearchRequest } from './search-request';

const fixtureLots = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/auction-data/lots.json'), 'utf8'),
) as AuctionLot[];

function page(data: AuctionLot[]): PaginatedSearchResult<AuctionLot> {
  return {
    data,
    total: data.length,
    page: 1,
    limit: data.length || 10,
    totalPages: data.length > 0 ? 1 : 0,
  };
}

/** Fixture lots search for buyer session search until P2 POST /lots/search is wired. */
export class FixtureLotsSearchClient implements LotsSearchClient {
  async search(_request: SearchRequest): Promise<PaginatedSearchResult<AuctionLot>> {
    return page(fixtureLots);
  }
}
