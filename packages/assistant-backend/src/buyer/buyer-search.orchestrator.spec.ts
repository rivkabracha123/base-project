import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuctionLot } from '@monabid/shared';
import { deriveHardConstraints, emptyBuyerCriteria } from './buyer-criteria';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';
import type { LotSearchResult } from '../lots/lot-match';

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/auction-data/lots.json'), 'utf8'),
) as AuctionLot[];

// Wraps fixture lots as the single-page result the lots search API returns, with no match reasons.
const page = (data: AuctionLot[]): LotSearchResult => ({
  data: data.map((lot) => ({ lot, matchReasons: [] })),
  total: data.length,
  page: 1,
  limit: data.length || 10,
  totalPages: data.length > 0 ? 1 : 0,
});

// Smallest criteria the lots search can search by: one category filter (empty criteria never reach it).
const searchableCriteria = () => ({ ...emptyBuyerCriteria('en'), categories: ['rare_books'] });

const baseLead = {
  leadId: 'lead-1',
  status: 'new',
  createdAt: '2026-09-01T10:00:00.000Z',
  searchedAt: '2026-09-01T10:01:00.000Z',
};

// Builds a full AuctionLot for tests, overriding any fields via `over`.
const makeLot = (over: Partial<AuctionLot> & { id: string }): AuctionLot => ({
  source: {
    provider: 'test',
    recordId: over.id,
    url: `https://example.com/${over.id}`,
    retrievedAt: '2025-01-01T00:00:00.000Z',
  },
  auctionHouse: { id: 'house-test', name: 'Test House' },
  auctionTitle: 'Test Auction',
  lotNumber: '1',
  title: { en: `Test Lot ${over.id}` },
  description: { en: 'A test lot.' },
  category: 'rare_books',
  saleDate: '2025-01-01',
  status: 'sold',
  ...over,
});

describe('BuyerSearchOrchestrator', () => {
  it('traces a named fixture from criteria through lots search to grouped results', async () => {
    const lotsSearch = { search: jest.fn().mockResolvedValue(page(fixture)) };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

    const criteria = emptyBuyerCriteria('en');
    criteria.creators = ['Yitzhak Abrabanel'];
    criteria.keywords = ['manuscript'];

    const outcome = await orchestrator.search({ criteria, language: 'en', ...baseLead });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.searchRequest).toEqual({
      criteria,
      language: 'en',
      hardConstraints: [
        {
          field: 'creators',
          operator: 'contains',
          value: ['Yitzhak Abrabanel'],
          reason: 'Buyer requirement kept through refinement',
        },
      ],
    });
    expect(outcome.results.current).toEqual([]);
    expect(outcome.results.historical.map((entry) => entry.lot)).toEqual(fixture);
    expect(lotsSearch.search).toHaveBeenCalledWith({
      query: 'manuscript',
      language: 'en',
      filters: { creators: ['Yitzhak Abrabanel'] },
    });
  });

  it('records an honest no-result summary without inventing inventory or private data', async () => {
    const lotsSearch = { search: jest.fn().mockResolvedValue(page([])) };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);
    const criteria = emptyBuyerCriteria('he');
    criteria.creators = ['Yitzhak Abrabanel'];
    criteria.price = { min: 1000, max: 15000, currency: 'USD' };

    const outcome = await orchestrator.search({
      criteria,
      language: 'he',
      ...baseLead,
      leadId: 'lead-unmatched-1',
    });

    const expectedHardConstraints = [
      {
        field: 'price',
        operator: 'range',
        value: { min: 1000, max: 15000, currency: 'USD' },
        reason: 'Buyer budget is a hard limit and is not relaxed without approval',
      },
      {
        field: 'creators',
        operator: 'contains',
        value: ['Yitzhak Abrabanel'],
        reason: 'Buyer requirement kept through refinement',
      },
    ];

    expect(outcome).toEqual({
      kind: 'unmatched',
      view: {
        id: 'lead-unmatched-1',
        type: 'buyer',
        status: 'new',
        createdAt: '2026-09-01T10:00:00.000Z',
        unmatchedDemand: {
          searchRequest: { criteria, language: 'he', hardConstraints: expectedHardConstraints },
          reason: 'no_results',
          searchedAt: '2026-09-01T10:01:00.000Z',
          demandSummary: {
            appliedCriteria: ['price', 'creators'],
            hardConstraints: expectedHardConstraints,
            recovery: 'no_relaxation_no_invention',
          },
        },
      },
      relaxationOptions: [
        { field: 'creators', requiresApproval: true },
        { field: 'price', requiresApproval: true },
      ],
    });
    expect(JSON.stringify(outcome)).not.toContain('profileId');
    expect(JSON.stringify(outcome)).not.toContain('conversation');
  });

  it('carries every received hard-filter field onto the grouped search results output, not just budget and category', async () => {
    const lotsSearch = {
      search: jest.fn().mockResolvedValue(page([makeLot({ id: 'lot-1' }), makeLot({ id: 'lot-2' })])),
    };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

    // Criteria after a refinement turn, carrying several strict filters.
    const criteria = emptyBuyerCriteria('en');
    criteria.price = { min: 2000, max: 15000, currency: 'USD' };
    criteria.categories = ['rare_books'];
    criteria.creators = ['Yitzhak Abrabanel'];
    criteria.periods = ['15th'];
    criteria.geography = ['Israel'];
    criteria.hardConstraints = deriveHardConstraints(criteria);

    const outcome = await orchestrator.search({ criteria, language: 'en', ...baseLead });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.searchRequest.criteria).toEqual(criteria);
    expect(outcome.searchRequest.hardConstraints).toEqual(criteria.hardConstraints);
    expect(outcome.results.current).toHaveLength(0);
    expect(outcome.results.historical).toHaveLength(2);
  });

  it('does not loosen the budget it received when building the search output', async () => {
    const lotsSearch = { search: jest.fn().mockResolvedValue(page([makeLot({ id: 'lot-1' })])) };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);
    const criteria = emptyBuyerCriteria('en');
    criteria.price = { min: 2000, max: 15000, currency: 'USD' };

    const outcome = await orchestrator.search({ criteria, language: 'en', ...baseLead });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.searchRequest.criteria.price).toEqual({ min: 2000, max: 15000, currency: 'USD' });
    expect(outcome.searchRequest.hardConstraints).toContainEqual({
      field: 'price',
      operator: 'range',
      value: { min: 2000, max: 15000, currency: 'USD' },
      reason: 'Buyer budget is a hard limit and is not relaxed without approval',
    });
  });

  it('carries a selected lot id through to the grouped search results', async () => {
    const lotsSearch = { search: jest.fn().mockResolvedValue(page([makeLot({ id: 'lot-1' })])) };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

    const outcome = await orchestrator.search({
      criteria: searchableCriteria(),
      language: 'en',
      ...baseLead,
      selectedLotId: 'lot-1',
    });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.selectedLotId).toBe('lot-1');
  });

  it('carries the tightened criteria through a refinement turn without reverting to the earlier budget', async () => {
    const lotsSearch = { search: jest.fn().mockResolvedValue(page([makeLot({ id: 'lot-1' })])) };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

    // First turn: a broad request.
    const firstTurn = emptyBuyerCriteria('en');
    firstTurn.categories = ['rare_books'];
    firstTurn.price = { min: 1000, max: 50000, currency: 'USD' };
    await orchestrator.search({ criteria: firstTurn, language: 'en', ...baseLead });

    // Second turn: The refined criteria are passed - narrower budget, extra strict filters.
    const refinedTurn = emptyBuyerCriteria('en');
    refinedTurn.categories = ['rare_books'];
    refinedTurn.creators = ['Yitzhak Abrabanel'];
    refinedTurn.periods = ['15th'];
    refinedTurn.price = { min: 2000, max: 15000, currency: 'USD' };

    const outcome = await orchestrator.search({ criteria: refinedTurn, language: 'en', ...baseLead });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    // The refined set is carried verbatim - no field dropped, budget not widened back toward turn one.
    expect(outcome.searchRequest.criteria).toEqual(refinedTurn);
    expect(outcome.searchRequest.criteria.price).toEqual({ min: 2000, max: 15000, currency: 'USD' });
  });

  it('builds results only from what the lots search API returned and never reads a raw source', async () => {
    const returned = [makeLot({ id: 'lot-a' }), makeLot({ id: 'lot-b' })];
    const lotsSearch = { search: jest.fn().mockResolvedValue(page(returned)) };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);
    const criteria = emptyBuyerCriteria('en');
    criteria.creators = ['Someone'];

    const outcome = await orchestrator.search({
      criteria,
      language: 'en',
      ...baseLead,
    });

    expect(lotsSearch.search).toHaveBeenCalledTimes(1);
    expect(lotsSearch.search).toHaveBeenCalledWith({
      query: '',
      language: 'en',
      filters: { creators: ['Someone'] },
    });
    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.results.historical.map((entry) => entry.lot)).toEqual(returned);
    expect(outcome.results.historical[0]?.lot).toBe(returned[0]);
  });

  it('reports in-process progress to an optional callback, in order, with no lot data', async () => {
    const lotsSearch = { search: jest.fn().mockResolvedValue(page([makeLot({ id: 'lot-1' })])) };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);
    const progress: unknown[] = [];

    await orchestrator.search(
      { criteria: searchableCriteria(), language: 'en', ...baseLead },
      (update) => progress.push(update),
    );

    expect(progress).toEqual([{ stage: 'searching' }, { stage: 'results-found', count: 1 }]);
  });

  it('reports a no-results progress stage when the lots search returns nothing', async () => {
    const lotsSearch = { search: jest.fn().mockResolvedValue(page([])) };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);
    const progress: unknown[] = [];

    await orchestrator.search(
      { criteria: searchableCriteria(), language: 'en', ...baseLead },
      (update) => progress.push(update),
    );

    expect(progress).toEqual([{ stage: 'searching' }, { stage: 'no-results' }]);
  });

  it('reports an error stage when the lots search fails, and still rethrows the original error', async () => {
    const failure = new Error('lots search unavailable');
    const lotsSearch = { search: jest.fn().mockRejectedValue(failure) };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);
    const progress: unknown[] = [];

    await expect(
      orchestrator.search(
        { criteria: searchableCriteria(), language: 'en', ...baseLead },
        (update) => progress.push(update),
      ),
    ).rejects.toBe(failure);

    expect(progress).toEqual([{ stage: 'searching' }, { stage: 'error' }]);
  });

  it('keeps searching when the progress callback itself throws', async () => {
    const lotsSearch = { search: jest.fn().mockResolvedValue(page([makeLot({ id: 'lot-1' })])) };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

    const outcome = await orchestrator.search(
      { criteria: searchableCriteria(), language: 'en', ...baseLead },
      () => {
        throw new Error('listener broke');
      },
    );

    expect(outcome.kind).toBe('results');
  });

  it('reports an error, not a no-result, when saving the unmatched demand fails, and rethrows', async () => {
    const failure = new Error('demand store unavailable');
    const lotsSearch = { search: jest.fn().mockResolvedValue(page([])) };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch, undefined, {
      record: jest.fn().mockRejectedValue(failure),
    });
    const progress: unknown[] = [];

    await expect(
      orchestrator.search(
        { criteria: searchableCriteria(), language: 'en', ...baseLead },
        (update) => progress.push(update),
      ),
    ).rejects.toBe(failure);

    expect(progress).toEqual([{ stage: 'searching' }, { stage: 'error' }]);
  });

  it('treats a malformed lots search response as a failure and records no false demand', async () => {
    const lotsSearch = { search: jest.fn().mockResolvedValue({ total: 0 }) };
    const record = jest.fn();
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch, undefined, { record });
    const progress: unknown[] = [];

    await expect(
      orchestrator.search(
        { criteria: searchableCriteria(), language: 'en', ...baseLead },
        (update) => progress.push(update),
      ),
    ).rejects.toThrow('Lots search returned no result list');

    expect(progress).toEqual([{ stage: 'searching' }, { stage: 'error' }]);
    expect(record).not.toHaveBeenCalled();
  });

  it('works with no callback at all, unchanged from before', async () => {
    const lotsSearch = { search: jest.fn().mockResolvedValue(page([makeLot({ id: 'lot-1' })])) };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

    const outcome = await orchestrator.search({
      criteria: searchableCriteria(),
      language: 'en',
      ...baseLead,
    });

    expect(outcome.kind).toBe('results');
  });

  describe('searchOtherCategories', () => {
    // Buyer wants rare books by a creator within a budget, with the category kept as a hard constraint.
    const otherCategoriesCriteria = () => {
      const criteria = emptyBuyerCriteria('he');
      criteria.categories = ['ספרים נדירים'];
      criteria.creators = ['Yitzhak Abrabanel'];
      criteria.price = { max: 5000, currency: 'USD' };
      criteria.hardConstraints = deriveHardConstraints(criteria);
      return criteria;
    };

    it('searches the other criteria without the category filter and keeps the original criteria untouched', async () => {
      const lotsSearch = { search: jest.fn().mockResolvedValue(page([makeLot({ id: 'lot-j', category: 'judaica' })])) };
      const orchestrator = new BuyerSearchOrchestrator(lotsSearch);
      const criteria = otherCategoriesCriteria();
      const original = structuredClone(criteria);

      const outcome = await orchestrator.searchOtherCategories({ criteria, language: 'he', ...baseLead });

      const sent = lotsSearch.search.mock.calls[0][0];
      expect(sent.filters.categories).toBeUndefined();
      expect(sent.filters.creators).toEqual(['Yitzhak Abrabanel']);
      expect(sent.filters.price).toEqual({ max: 5000, currency: 'USD' });
      expect(criteria).toEqual(original);
      expect(outcome.kind).toBe('results');
      if (outcome.kind !== 'results') return;
      expect(outcome.searchRequest.criteria.categories).toEqual([]);
      expect(outcome.searchRequest.hardConstraints.map((constraint) => constraint.field)).not.toContain('categories');
      expect(outcome.searchRequest.hardConstraints.map((constraint) => constraint.field)).toContain('price');
    });

    it('drops lots in the requested category, matching Hebrew and English names, and keeps the search order', async () => {
      const lotsSearch = {
        search: jest.fn().mockResolvedValue(
          page([
            makeLot({ id: 'lot-j', category: 'judaica', status: 'upcoming' }),
            makeLot({ id: 'lot-book', category: 'rare_books' }),
            makeLot({ id: 'lot-map', category: 'maps' }),
          ]),
        ),
      };
      const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

      const outcome = await orchestrator.searchOtherCategories({
        criteria: otherCategoriesCriteria(),
        language: 'he',
        ...baseLead,
      });

      expect(outcome.kind).toBe('results');
      if (outcome.kind !== 'results') return;
      expect(outcome.results.current.map((entry) => entry.lot.id)).toEqual(['lot-j']);
      expect(outcome.results.historical.map((entry) => entry.lot.id)).toEqual(['lot-map']);
    });

    it('returns unmatched without recording demand when only the requested category came back', async () => {
      const lotsSearch = { search: jest.fn().mockResolvedValue(page([makeLot({ id: 'lot-book' })])) };
      const record = jest.fn();
      const orchestrator = new BuyerSearchOrchestrator(lotsSearch, undefined, { record });
      const progress: unknown[] = [];

      const outcome = await orchestrator.searchOtherCategories(
        { criteria: otherCategoriesCriteria(), language: 'he', ...baseLead },
        (update) => progress.push(update),
      );

      expect(outcome.kind).toBe('unmatched');
      if (outcome.kind !== 'unmatched') return;
      expect(outcome.relaxationOptions.map((option) => option.field)).not.toContain('categories');
      expect(record).not.toHaveBeenCalled();
      expect(progress).toEqual([{ stage: 'searching' }, { stage: 'no-results' }]);
    });

    it('reports insufficient criteria when the buyer asked for a category only', async () => {
      const lotsSearch = { search: jest.fn() };
      const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

      const outcome = await orchestrator.searchOtherCategories({
        criteria: searchableCriteria(),
        language: 'en',
        ...baseLead,
      });

      expect(outcome.kind).toBe('insufficient-criteria');
      expect(lotsSearch.search).not.toHaveBeenCalled();
    });

    it('still records demand for a regular search after an other-categories search', async () => {
      const lotsSearch = { search: jest.fn().mockResolvedValue(page([])) };
      const record = jest.fn();
      const orchestrator = new BuyerSearchOrchestrator(lotsSearch, undefined, { record });
      const input = { criteria: otherCategoriesCriteria(), language: 'he' as const, ...baseLead };

      await orchestrator.searchOtherCategories(input);
      await orchestrator.search(input);

      expect(record).toHaveBeenCalledTimes(1);
    });
  });
});
