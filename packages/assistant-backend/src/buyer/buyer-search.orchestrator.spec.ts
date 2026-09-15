import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuctionLot } from '@monabid/shared';
import { deriveHardConstraints, emptyBuyerCriteria } from './buyer-criteria';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/auction-data/lots.json'), 'utf8'),
) as AuctionLot[];

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
    const p2 = { searchByText: jest.fn().mockResolvedValue(fixture) };
    const orchestrator = new BuyerSearchOrchestrator(p2);

    const criteria = emptyBuyerCriteria('en');
    criteria.creators = ['Yitzhak Abrabanel'];
    criteria.keywords = ['manuscript'];

    const outcome = await orchestrator.search({ criteria, language: 'en', ...baseLead });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.searchRequest).toEqual({ criteria, language: 'en', hardConstraints: [] });
    expect(outcome.items).toEqual(fixture);
    expect(p2.searchByText).toHaveBeenCalledWith('Yitzhak Abrabanel manuscript', 'en');
  });

  it('records an honest no-result request for P5 without inventing inventory or private data', async () => {
    const p2 = { searchByText: jest.fn().mockResolvedValue([]) };
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

    expect(outcome).toEqual({
      kind: 'unmatched',
      view: {
        id: 'lead-unmatched-1',
        type: 'buyer',
        status: 'new',
        createdAt: '2026-09-01T10:00:00.000Z',
        unmatchedDemand: {
          searchRequest: { criteria, language: 'he', hardConstraints: [] },
          reason: 'no_results',
          searchedAt: '2026-09-01T10:01:00.000Z',
        },
      },
    });
    expect(JSON.stringify(outcome)).not.toContain('profileId');
    expect(JSON.stringify(outcome)).not.toContain('conversation');
  });

  it('carries every received hard-filter field onto the B4 results handoff, not just budget and category', async () => {
    const p2 = {
      searchByText: jest.fn().mockResolvedValue([makeLot({ id: 'lot-1' }), makeLot({ id: 'lot-2' })]),
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
    expect(outcome.items).toHaveLength(2);
  });

  it('does not loosen the budget it received when building the handoff', async () => {
    const p2 = { searchByText: jest.fn().mockResolvedValue([makeLot({ id: 'lot-1' })]) };
    const orchestrator = new BuyerSearchOrchestrator(p2);
    const criteria = emptyBuyerCriteria('en');
    criteria.price = { min: 2000, max: 15000, currency: 'USD' };

    const outcome = await orchestrator.search({ criteria, language: 'en', ...baseLead });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.searchRequest.criteria.price).toEqual({ min: 2000, max: 15000, currency: 'USD' });
  });

  it('carries the tightened criteria through a refinement turn without reverting to the earlier budget', async () => {
    const p2 = { searchByText: jest.fn().mockResolvedValue([makeLot({ id: 'lot-1' })]) };
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
    const p2 = { searchByText: jest.fn().mockResolvedValue(returned) };
    const orchestrator = new BuyerSearchOrchestrator(p2);
    const criteria = emptyBuyerCriteria('en');
    criteria.creators = ['Someone'];

    const outcome = await orchestrator.search({
      criteria,
      language: 'en',
      ...baseLead,
    });

    expect(p2.searchByText).toHaveBeenCalledTimes(1);
    expect(p2.searchByText).toHaveBeenCalledWith('Someone', 'en');
    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.items).toBe(returned);
  });
});
