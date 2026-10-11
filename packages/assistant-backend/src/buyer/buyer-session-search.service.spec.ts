import type { AuctionLot } from '@monabid/shared';
import type { LotsService } from '../lots/lots.service';
import { deriveHardConstraints, emptyBuyerCriteria, type BuyerCriteria } from './buyer-criteria';
import { createBuyerCriteriaSession, resetBuyerCriteriaSessions } from './buyer-criteria-session.store';
import { BuyerSessionSearchService } from './buyer-session-search.service';
import { LotsServiceSearchClient } from './lots-service-search.client';
import type { PaginatedSearchResult } from './search-request';

// Wraps synthetic lots as the single-page PaginatedResult the lots search API returns.
const page = (data: AuctionLot[]): PaginatedSearchResult<AuctionLot> => ({
  data,
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
      query: 'Yitzhak Abrabanel manuscript',
      language: 'he',
      page: 1,
      limit: 50,
      filters: {
        categories: ['rare_books'],
        auctionHouseIds: ['house-kestenbaum'],
        dateRange: { from: '2024-01-01', to: '2025-12-31' },
        price: { max: 15000, currency: 'USD' },
      },
    });
  });

  // Holds only until BuyerSearchOrchestrator gains searchOtherCategories; once it does, this test is
  // expected to fail and should be replaced by one that runs the follow-up against the real orchestrator.
  it('reports the other-categories search as unavailable while the orchestrator does not provide it', async () => {
    const lotsService = { search: jest.fn().mockResolvedValue(page([syntheticLot])) };
    const service = new BuyerSessionSearchService(
      new LotsServiceSearchClient(lotsService as unknown as LotsService),
    );
    const { sessionId } = createBuyerCriteriaSession({
      criteria: fullCriteria(),
      conversation: { skipped: ['location'], missing: [], nextQuestion: '', notes: [] },
    });

    const response = await service.searchOtherCategoriesForSession(sessionId);

    expect(response).toEqual({ kind: 'unavailable' });
    expect(lotsService.search).not.toHaveBeenCalled();
  });
});
