import { auctionLotFixtureSchema, type AuctionLot } from '@monabid/shared';
import lotsData from '../../../../fixtures/auction-data/lots.json';
import buyerSearchScenarioData from '../../../../fixtures/demo-scenarios/buyer-search-preserved-budget.json';

type BuyerCriteriaFixture = {
  budget?: { min?: number; max?: number };
  category?: string | null;
  creator?: string | null;
  period?: string | null;
  media?: string;
  keywords?: string[];
  geography?: string;
  location?: string | null;
  color?: string | null;
  notes?: string[];
  missing: string[];
  nextQuestion?: string;
};

type ConstraintFixture = {
  field: 'budget' | 'category' | 'creator' | 'period' | 'location';
  operator: 'equal' | 'range' | 'contains';
  value: unknown;
  reason: string;
};

type BuyerSearchRequestFixture = {
  criteria: BuyerCriteriaFixture;
  language: 'he' | 'en';
  hardConstraints: ConstraintFixture[];
};

type UnmatchedDemandDashboardViewFixture = {
  id: string;
  type: 'buyer';
  status: string;
  createdAt: string;
  unmatchedDemand: {
    searchRequest: {
      criteria: BuyerCriteriaFixture;
      language: 'he' | 'en';
      hardConstraints: ConstraintFixture[];
    };
    reason: 'no_results';
    searchedAt: string;
  };
};

/**
 * Local deterministic copy of B3's JSON response contract until B3 publishes
 * the type in @monabid/shared. It must not be used to make live API calls.
 */
export type MatchReasonFixture = {
  field: string;
  detail: string;
};

export type ExplainedLotFixture = {
  lot: AuctionLot;
  matchReasons: MatchReasonFixture[];
};

export type BuyerSearchResultsFixture = {
  kind: 'results';
  searchRequest: BuyerSearchRequestFixture;
  results: {
    current: ExplainedLotFixture[];
    historical: ExplainedLotFixture[];
  };
  approvedRefinements: string[];
  selectedLotId?: string;
};

export type BuyerSearchOutcomeFixture =
  | BuyerSearchResultsFixture
  | { kind: 'unmatched'; view: UnmatchedDemandDashboardViewFixture };

const lots = auctionLotFixtureSchema.parse(lotsData);
const buyerSearchScenario = buyerSearchScenarioData as {
  expected: {
    results: {
      searchRequest: BuyerSearchRequestFixture;
      itemIds: string[];
    };
    unmatched: {
      view: UnmatchedDemandDashboardViewFixture;
    };
  };
};

const resultLots = buyerSearchScenario.expected.results.itemIds.map((id) => {
  const lot = lots.find((fixture) => fixture.id === id);
  if (!lot) throw new Error(`B3 results fixture requires validated auction lot ${id}`);
  return lot;
});

export const resultsSearchOutcomeFixture: BuyerSearchResultsFixture = {
  kind: 'results',
  searchRequest: buyerSearchScenario.expected.results.searchRequest,
  // The Week 3 JSON records ids only for readability. B4 turns them into
  // complete lots here until B3's Week 4 fixture is published.
  results: {
    current: resultLots
      .filter((lot) => lot.status === 'upcoming')
      .map((lot) => ({ lot, matchReasons: [] })),
    historical: resultLots
      .filter((lot) => lot.status !== 'upcoming')
      .map((lot) => ({ lot, matchReasons: [] })),
  },
  approvedRefinements: [],
};

export const unmatchedSearchOutcomeFixture: BuyerSearchOutcomeFixture = {
  kind: 'unmatched',
  view: buyerSearchScenario.expected.unmatched.view,
};
