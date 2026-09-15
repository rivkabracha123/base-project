import { auctionLotFixtureSchema, type AuctionLot } from '@monabid/shared';
import lotsData from '../../../../fixtures/auction-data/lots.json';

type SearchRequestFixture = {
  query: string;
  language: 'he' | 'en';
};

type UnmatchedDemandDashboardViewFixture = {
  id: string;
  type: 'buyer';
  status: string;
  createdAt: string;
  unmatchedDemand: {
    searchRequest: {
      criteria: {
        creator: string;
        budget: { min: number; max: number };
        missing: string[];
      };
      language: 'he' | 'en';
      hardConstraints: string[];
    };
    reason: 'no_results';
    searchedAt: string;
  };
};

/**
 * Local deterministic copy of B3's JSON response contract until B3 publishes
 * the type in @monabid/shared. It must not be used to make live API calls.
 */
export type BuyerSearchResultsFixture = {
  kind: 'results';
  searchRequest: SearchRequestFixture;
  items: AuctionLot[];
};

export type BuyerSearchOutcomeFixture =
  | BuyerSearchResultsFixture
  | { kind: 'unmatched'; view: UnmatchedDemandDashboardViewFixture };

const lots = auctionLotFixtureSchema.parse(lotsData);
const firstLot = lots[0];

if (!firstLot) {
  throw new Error('B3 results fixture requires at least one validated auction lot');
}

export const resultsSearchOutcomeFixture: BuyerSearchResultsFixture = {
  kind: 'results',
  searchRequest: {
    query: 'Yitzhak Abrabanel manuscript',
    language: 'en',
  },
  items: [firstLot],
};

export const unmatchedSearchOutcomeFixture: BuyerSearchOutcomeFixture = {
  kind: 'unmatched',
  view: {
    id: 'lead-unmatched-1',
    type: 'buyer',
    status: 'new',
    createdAt: '2026-09-01T10:00:00.000Z',
    unmatchedDemand: {
      searchRequest: {
        criteria: {
          creator: 'Yitzhak Abrabanel',
          budget: { min: 1000, max: 15000 },
          missing: [],
        },
        language: 'he',
        hardConstraints: [],
      },
      reason: 'no_results',
      searchedAt: '2026-09-01T10:01:00.000Z',
    },
  },
};
