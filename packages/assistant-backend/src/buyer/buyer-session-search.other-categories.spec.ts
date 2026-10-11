import type { AuctionLot } from '@monabid/shared';
import { deriveHardConstraints, emptyBuyerCriteria, type BuyerCriteria } from './buyer-criteria';
import {
  createBuyerCriteriaSession,
  getBuyerCriteriaSession,
  resetBuyerCriteriaSessions,
} from './buyer-criteria-session.store';
import type { BuyerSearchInput, LotsSearchClient } from './buyer-search.orchestrator';
import { BuyerSessionSearchService, type OtherCategoriesSearchOutcome } from './buyer-session-search.service';
import { buildDemandSummary } from './explained-results';
import { createUnmatchedDemandDashboardView } from './unmatched-demand-dashboard-view';

// The cross-category search itself is owned by BuyerSearchOrchestrator.searchOtherCategories.
// It is mocked here, so these tests cover only the Buyer Chat side: the input handed over and
// how each outcome is mapped for the chat. The outcomes below carry the fields of the orchestrator's
// real contract (approvedRefinements, relaxationOptions, searchRequest), not only the ones the chat reads.
const mockSearchOtherCategories = jest.fn<Promise<OtherCategoriesSearchOutcome>, [BuyerSearchInput]>();

jest.mock('./buyer-search.orchestrator', () => ({
  BuyerSearchOrchestrator: jest.fn().mockImplementation(() => ({
    searchOtherCategories: mockSearchOtherCategories,
  })),
}));

// Builds a full synthetic AuctionLot for tests, overriding any fields via `over`.
const makeLot = (over: Partial<AuctionLot> & { id: string }): AuctionLot => ({
  source: {
    provider: 'test',
    recordId: over.id,
    url: `https://example.com/${over.id}`,
    retrievedAt: '2025-01-01T00:00:00.000Z',
  },
  auctionHouse: { id: 'house-kestenbaum', name: 'Kestenbaum & Company' },
  auctionTitle: 'Synthetic Auction',
  lotNumber: '1',
  title: { en: `Synthetic manuscript ${over.id}` },
  description: { en: 'A synthetic lot.' },
  category: 'rare_books',
  saleDate: '2025-01-01',
  status: 'sold',
  realizedPrice: { amount: 1200, currency: 'USD' },
  ...over,
});

const upcomingOtherCategoryLot = makeLot({
  id: 'lot-synthetic-other-category-upcoming',
  category: 'synthetic_other_category',
  saleDate: '2026-12-01',
  status: 'upcoming',
  realizedPrice: undefined,
});
const soldOtherCategoryLot = makeLot({
  id: 'lot-synthetic-other-category-sold',
  category: 'synthetic_other_category',
});
const soldOriginalCategoryLot = makeLot({ id: 'lot-synthetic-original-category-sold' });

// Session criteria as they stand after a completed buyer search, category included.
function fullCriteria(): BuyerCriteria {
  const criteria: BuyerCriteria = {
    ...emptyBuyerCriteria('he'),
    categories: ['rare_books'],
    creators: ['Yitzhak Abrabanel'],
    keywords: ['manuscript'],
    periods: ['19th'],
    auctionHouseIds: ['house-kestenbaum'],
    dateRange: { from: '2024-01-01', to: '2025-12-31' },
    price: { max: 15000, currency: 'USD' },
  };
  return { ...criteria, hardConstraints: deriveHardConstraints(criteria) };
}

function startSession(): string {
  return createBuyerCriteriaSession({
    criteria: fullCriteria(),
    conversation: { skipped: ['location'], missing: [], nextQuestion: '', notes: [] },
  }).sessionId;
}

function searchRequest() {
  const criteria = fullCriteria();
  return { criteria, language: criteria.language, hardConstraints: criteria.hardConstraints };
}

// The single BuyerSearchInput the service handed to searchOtherCategories.
function handedOverInput(): BuyerSearchInput {
  const call = mockSearchOtherCategories.mock.calls[0];
  if (!call) throw new Error('searchOtherCategories was not called');
  return call[0];
}

function resultsOutcome() {
  return {
    kind: 'results' as const,
    searchRequest: searchRequest(),
    results: {
      current: [{ lot: upcomingOtherCategoryLot, matchReasons: [{ field: 'query', detail: 'manuscript' }] }],
      historical: [
        { lot: soldOtherCategoryLot, matchReasons: [{ field: 'query', detail: 'manuscript' }] },
        { lot: soldOriginalCategoryLot, matchReasons: [{ field: 'creators', detail: 'Yitzhak Abrabanel' }] },
      ],
    },
    approvedRefinements: [],
  };
}

function unmatchedOutcome(sessionId: string) {
  return {
    kind: 'unmatched' as const,
    relaxationOptions: [],
    view: createUnmatchedDemandDashboardView({
      id: sessionId,
      status: 'new',
      createdAt: '2026-09-01T10:00:00.000Z',
      searchedAt: '2026-09-01T10:00:00.000Z',
      searchRequest: searchRequest(),
      demandSummary: buildDemandSummary(fullCriteria()),
    }),
  };
}

describe('BuyerSessionSearchService.searchOtherCategoriesForSession', () => {
  const lotsSearch: LotsSearchClient = { search: jest.fn() };
  let service: BuyerSessionSearchService;

  beforeEach(() => {
    resetBuyerCriteriaSessions();
    mockSearchOtherCategories.mockReset();
    mockSearchOtherCategories.mockResolvedValue(resultsOutcome());
    service = new BuyerSessionSearchService(lotsSearch);
  });

  describe('input handed to BuyerSearchOrchestrator.searchOtherCategories', () => {
    it('passes the full BuyerSearchInput built from the session', async () => {
      const sessionId = startSession();

      await service.searchOtherCategoriesForSession(sessionId);

      expect(mockSearchOtherCategories).toHaveBeenCalledTimes(1);
      const input = handedOverInput();
      expect(input.criteria).toEqual(fullCriteria());
      expect(input.language).toBe('he');
      expect(input.leadId).toBe(sessionId);
      expect(input.status).toBe('new');
      expect(new Date(input.createdAt).toISOString()).toBe(input.createdAt);
      expect(new Date(input.searchedAt).toISOString()).toBe(input.searchedAt);
    });

    it('keeps the original category in the input', async () => {
      const sessionId = startSession();

      await service.searchOtherCategoriesForSession(sessionId);

      const input = handedOverInput();
      expect(input.criteria.categories).toEqual(['rare_books']);
      expect(input.criteria.hardConstraints).toEqual(deriveHardConstraints(fullCriteria()));
    });

    it('preserves keywords, creator, period, budget, date range, and auction houses', async () => {
      const sessionId = startSession();

      await service.searchOtherCategoriesForSession(sessionId);

      const input = handedOverInput();
      expect(input.criteria.keywords).toEqual(['manuscript']);
      expect(input.criteria.creators).toEqual(['Yitzhak Abrabanel']);
      expect(input.criteria.periods).toEqual(['19th']);
      expect(input.criteria.price).toEqual({ max: 15000, currency: 'USD' });
      expect(input.criteria.dateRange).toEqual({ from: '2024-01-01', to: '2025-12-31' });
      expect(input.criteria.auctionHouseIds).toEqual(['house-kestenbaum']);
    });

    it('does not mutate the stored session criteria', async () => {
      const sessionId = startSession();
      const before = structuredClone(getBuyerCriteriaSession(sessionId));

      await service.searchOtherCategoriesForSession(sessionId);

      expect(getBuyerCriteriaSession(sessionId)).toEqual(before);
    });

    it('leaves the search to the orchestrator and never calls the lots search client itself', async () => {
      const sessionId = startSession();

      await service.searchOtherCategoriesForSession(sessionId);

      expect(lotsSearch.search).not.toHaveBeenCalled();
    });
  });

  describe('outcome mapping', () => {
    it('maps a results outcome to upcoming and past groups, keeping every lot the orchestrator returned', async () => {
      const sessionId = startSession();

      const response = await service.searchOtherCategoriesForSession(sessionId);

      expect(response.kind).toBe('results');
      if (response.kind !== 'results') return;
      expect(response.groups.map((group) => group.lots)).toEqual([
        [upcomingOtherCategoryLot],
        [soldOtherCategoryLot, soldOriginalCategoryLot],
      ]);
      for (const group of response.groups) {
        expect(group.title.trim().length).toBeGreaterThan(0);
      }
    });

    it('omits an empty group from a results outcome', async () => {
      const sessionId = startSession();
      const outcome = resultsOutcome();
      mockSearchOtherCategories.mockResolvedValue({
        ...outcome,
        results: { current: [], historical: outcome.results.historical },
      });

      const response = await service.searchOtherCategoriesForSession(sessionId);

      expect(response.kind).toBe('results');
      if (response.kind !== 'results') return;
      expect(response.groups.map((group) => group.lots)).toEqual([
        [soldOtherCategoryLot, soldOriginalCategoryLot],
      ]);
    });

    it('maps an unmatched outcome to an unmatched response with a message', async () => {
      const sessionId = startSession();
      mockSearchOtherCategories.mockResolvedValue(unmatchedOutcome(sessionId));

      const response = await service.searchOtherCategoriesForSession(sessionId);

      expect(response.kind).toBe('unmatched');
      if (response.kind !== 'unmatched') return;
      expect(response.message.trim().length).toBeGreaterThan(0);
      // The regular search's wording is about relaxing filters, which does not apply to this follow-up.
      expect(response.message).not.toContain('לרפות');
    });

    it('maps an insufficient-criteria outcome to an insufficient-criteria response with a message', async () => {
      const sessionId = startSession();
      const outcome = { kind: 'insufficient-criteria' as const, searchRequest: searchRequest() };
      mockSearchOtherCategories.mockResolvedValue(outcome);

      const response = await service.searchOtherCategoriesForSession(sessionId);

      expect(response.kind).toBe('insufficient-criteria');
      if (response.kind !== 'insufficient-criteria') return;
      expect(response.message.trim().length).toBeGreaterThan(0);
    });
  });
});
