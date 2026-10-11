import type { AuctionLot } from '@monabid/shared';
import type { LotsService } from '../lots/lots.service';
import { deriveHardConstraints, emptyBuyerCriteria, type BuyerCriteria } from './buyer-criteria';
import { createBuyerCriteriaSession, resetBuyerCriteriaSessions } from './buyer-criteria-session.store';
import { BuyerSessionSearchService } from './buyer-session-search.service';
import { LotsServiceSearchClient } from './lots-service-search.client';
import type { LotSearchResult } from '../lots/lot-match';

// Wraps synthetic lots as the single-page result the lots search API returns, with no match reasons.
const page = (data: AuctionLot[]): LotSearchResult => ({
  data: data.map((lot) => ({ lot, matchReasons: [] })),
  total: data.length,
  page: 1,
  limit: 50,
  totalPages: data.length > 0 ? 1 : 0,
});

const syntheticLot: AuctionLot = {
  id: 'lot-synthetic-original-category',
  source: {
    provider: 'test',
    recordId: 'lot-synthetic-original-category',
    url: 'https://example.com/lot-synthetic-original-category',
    retrievedAt: '2025-01-01T00:00:00.000Z',
  },
  auctionHouse: { id: 'house-kestenbaum', name: 'Kestenbaum & Company' },
  auctionTitle: 'Synthetic Auction',
  lotNumber: '1',
  title: { en: 'Synthetic manuscript' },
  description: { en: 'A synthetic lot.' },
  category: 'rare_books',
  saleDate: '2025-01-01',
  status: 'sold',
  realizedPrice: { amount: 1200, currency: 'USD' },
};

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

describe('BuyerSessionSearchService', () => {
  beforeEach(() => {
    resetBuyerCriteriaSessions();
  });

  it('sends the session criteria, category included, through the adapter to LotsService.search', async () => {
    // Real Buyer adapter (LotsServiceSearchClient) over a mocked LotsService.search.
    const lotsService = { search: jest.fn().mockResolvedValue(page([syntheticLot])) };
    const service = new BuyerSessionSearchService(
      new LotsServiceSearchClient(lotsService as unknown as LotsService),
    );
    const { sessionId } = createBuyerCriteriaSession({
      criteria: fullCriteria(),
      conversation: { skipped: ['location'], missing: [], nextQuestion: '', notes: [] },
    });

    await service.searchForSession(sessionId);

    expect(lotsService.search).toHaveBeenCalledTimes(1);
    expect(lotsService.search).toHaveBeenCalledWith({
      query: 'manuscript',
      language: 'he',
      page: 1,
      limit: 50,
      filters: {
        categories: ['rare_books'],
        creators: ['Yitzhak Abrabanel'],
        periods: ['19th century'],
        auctionHouseIds: ['house-kestenbaum'],
        dateRange: { from: '2024-01-01', to: '2025-12-31' },
        price: { max: 15000, currency: 'USD' },
      },
    });
  });

  it('runs the other-categories follow-up through the real orchestrator without the category filter', async () => {
    // The only lot returned is in the buyer's own category, so the orchestrator drops it.
    const lotsService = { search: jest.fn().mockResolvedValue(page([syntheticLot])) };
    const service = new BuyerSessionSearchService(
      new LotsServiceSearchClient(lotsService as unknown as LotsService),
    );
    const { sessionId } = createBuyerCriteriaSession({
      criteria: fullCriteria(),
      conversation: { skipped: ['location'], missing: [], nextQuestion: '', notes: [] },
    });

    const response = await service.searchOtherCategoriesForSession(sessionId);

    expect(lotsService.search).toHaveBeenCalledTimes(1);
    expect(lotsService.search.mock.calls[0][0].filters.categories).toBeUndefined();
    expect(response.kind).toBe('unmatched');
  });
});
