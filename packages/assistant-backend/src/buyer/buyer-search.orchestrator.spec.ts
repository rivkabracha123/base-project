import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuctionLot } from '@monabid/shared';
import { deriveHardConstraints, emptyBuyerCriteria } from './buyer-criteria';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';
import type { PaginatedSearchResult } from './search-request';

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/auction-data/lots.json'), 'utf8'),
) as AuctionLot[];

// Wraps fixture lots as the single-page PaginatedResult P2's real search() returns.
const page = (data: AuctionLot[]): PaginatedSearchResult<AuctionLot> => ({
  data,
  total: data.length,
  page: 1,
  limit: data.length || 10,
  totalPages: data.length > 0 ? 1 : 0,
});

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
  it('traces a named fixture from criteria through P2 to a B4-consumable result list', async () => {
    const p2 = { search: jest.fn().mockResolvedValue(page(fixture)) };
    const orchestrator = new BuyerSearchOrchestrator(p2);

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
    expect(p2.search).toHaveBeenCalledWith({
      query: 'Yitzhak Abrabanel manuscript',
      language: 'en',
    });
  });

  it('records an honest no-result request for P5 without inventing inventory or private data', async () => {
    const p2 = { search: jest.fn().mockResolvedValue(page([])) };
    const orchestrator = new BuyerSearchOrchestrator(p2);
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
    });
    expect(JSON.stringify(outcome)).not.toContain('profileId');
    expect(JSON.stringify(outcome)).not.toContain('conversation');
  });

  it('carries every received hard-filter field onto the B4 results handoff, not just budget and category', async () => {
    const p2 = {
      search: jest.fn().mockResolvedValue(page([makeLot({ id: 'lot-1' }), makeLot({ id: 'lot-2' })])),
    };
    const orchestrator = new BuyerSearchOrchestrator(p2);

    // Criteria as B2 hands them over after a refinement, carrying several strict filters.
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

  it('does not loosen the budget it received when building the handoff', async () => {
    const p2 = { search: jest.fn().mockResolvedValue(page([makeLot({ id: 'lot-1' })])) };
    const orchestrator = new BuyerSearchOrchestrator(p2);
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

  it('carries a selected lot id through to the B4 results handoff', async () => {
    const p2 = { search: jest.fn().mockResolvedValue(page([makeLot({ id: 'lot-1' })])) };
    const orchestrator = new BuyerSearchOrchestrator(p2);

    const outcome = await orchestrator.search({
      criteria: emptyBuyerCriteria('en'),
      language: 'en',
      ...baseLead,
      selectedLotId: 'lot-1',
    });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.selectedLotId).toBe('lot-1');
  });

  it('carries the tightened criteria through a refinement turn without reverting to the earlier budget', async () => {
    const p2 = { search: jest.fn().mockResolvedValue(page([makeLot({ id: 'lot-1' })])) };
    const orchestrator = new BuyerSearchOrchestrator(p2);

    // First turn: a broad request.
    const firstTurn = emptyBuyerCriteria('en');
    firstTurn.categories = ['rare_books'];
    firstTurn.price = { min: 1000, max: 50000, currency: 'USD' };
    await orchestrator.search({ criteria: firstTurn, language: 'en', ...baseLead });

    // Second turn: B2 hands over the refined criteria - narrower budget, extra strict filters.
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

  it('builds results only from what P2 returned and never reads a raw source', async () => {
    const returned = [makeLot({ id: 'lot-a' }), makeLot({ id: 'lot-b' })];
    const p2 = { search: jest.fn().mockResolvedValue(page(returned)) };
    const orchestrator = new BuyerSearchOrchestrator(p2);
    const criteria = emptyBuyerCriteria('en');
    criteria.creators = ['Someone'];

    const outcome = await orchestrator.search({
      criteria,
      language: 'en',
      ...baseLead,
    });

    expect(p2.search).toHaveBeenCalledTimes(1);
    expect(p2.search).toHaveBeenCalledWith({
      query: 'Someone',
      language: 'en',
    });
    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.results.historical.map((entry) => entry.lot)).toEqual(returned);
    expect(outcome.results.historical[0]?.lot).toBe(returned[0]);
  });
});
