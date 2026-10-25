import type { BuyerUnmatchedDemandDashboardView } from '@monabid/shared';
import type { UnmatchedDemandDbStore } from '../buyer/unmatched-demand.db-store';
import { UnmatchedDemandBuyerLeadDashboardSource } from './unmatched-demand-buyer-lead-dashboard.source';

describe('UnmatchedDemandBuyerLeadDashboardSource', () => {
  it('maps a recorded unmatched demand without creating contact data', async () => {
    const demand = {
      id: 'real-demand-001',
      type: 'buyer',
      status: 'new',
      createdAt: '2026-10-21T09:00:00.000Z',
      unmatchedDemand: {
        reason: 'no_results',
        searchedAt: '2026-10-21T09:01:00.000Z',
        searchRequest: {
          criteria: { categories: ['rare_books'], price: { max: 1500, currency: 'USD' } },
          language: 'en',
          hardConstraints: [{ field: 'price', operator: 'lte', value: 1500, reason: 'buyer budget' }],
        },
        demandSummary: {
          appliedCriteria: ['categories', 'price'],
          hardConstraints: [{ field: 'price', operator: 'lte', value: 1500, reason: 'buyer budget' }],
          recovery: 'no_relaxation_no_invention',
        },
        expansion: {
          searchRequest: {
            criteria: { categories: ['rare_books'], price: { max: 2500, currency: 'USD' } },
            language: 'en',
            hardConstraints: [{ field: 'price', operator: 'lte', value: 2500, reason: 'buyer budget' }],
          },
          changedFields: ['price'],
          searchedAt: '2026-10-21T09:05:00.000Z',
          outcome: 'results',
          resultCount: 2,
        },
      },
    } as unknown as BuyerUnmatchedDemandDashboardView;
    const store: Pick<UnmatchedDemandDbStore, 'get' | 'list'> = {
      get: jest.fn().mockResolvedValue(demand),
      list: jest.fn(),
    };
    const source = new UnmatchedDemandBuyerLeadDashboardSource(store);

    await expect(source.getBuyerLead('real-demand-001')).resolves.toMatchObject({
      id: 'real-demand-001',
      type: 'buyer',
      status: 'new',
      outcome: {
        kind: 'unmatched',
        view: {
          unmatchedDemand: {
            reason: 'no_results',
            searchedAt: '2026-10-21T09:01:00.000Z',
            demandSummary: { appliedCriteria: ['categories', 'price'] },
            expansion: { changedFields: ['price'], outcome: 'results', resultCount: 2 },
          },
        },
      },
      contact: {
        preferredName: null,
        email: null,
        phone: null,
        followUpStatus: 'contact_missing',
        serviceConsent: { granted: false },
      },
    });
    expect(store.get).toHaveBeenCalledWith('real-demand-001');
  });

  it('returns undefined when the buyer store has no matching demand', async () => {
    const store: Pick<UnmatchedDemandDbStore, 'get' | 'list'> = {
      get: jest.fn().mockResolvedValue(undefined),
      list: jest.fn(),
    };
    const source = new UnmatchedDemandBuyerLeadDashboardSource(store);

    await expect(source.getBuyerLead('missing-demand')).resolves.toBeUndefined();
  });

  it('lists recorded demands in the store order without adding private contact data', async () => {
    const newestDemand = {
      id: 'real-demand-newest',
      type: 'buyer',
      status: 'new',
      createdAt: '2026-10-21T10:00:00.000Z',
      unmatchedDemand: {
        reason: 'no_results',
        searchedAt: '2026-10-21T10:01:00.000Z',
        searchRequest: {
          criteria: { categories: ['judaica'] }, language: 'en', hardConstraints: [],
        },
        demandSummary: { appliedCriteria: ['categories'], hardConstraints: [], recovery: 'no_relaxation_no_invention' },
      },
    } as unknown as BuyerUnmatchedDemandDashboardView;
    const olderDemand = {
      ...newestDemand,
      id: 'real-demand-older',
      createdAt: '2026-10-20T10:00:00.000Z',
    } as BuyerUnmatchedDemandDashboardView;
    const store: Pick<UnmatchedDemandDbStore, 'get' | 'list'> = {
      get: jest.fn(),
      list: jest.fn().mockResolvedValue([newestDemand, olderDemand]),
    };
    const source = new UnmatchedDemandBuyerLeadDashboardSource(store);

    await expect(source.listBuyerLeads()).resolves.toEqual([
      expect.objectContaining({ id: 'real-demand-newest', createdAt: new Date('2026-10-21T10:00:00.000Z'), pipelineAvailable: false }),
      expect.objectContaining({ id: 'real-demand-older', createdAt: new Date('2026-10-20T10:00:00.000Z') }),
    ]);
    expect(store.list).toHaveBeenCalledWith();
  });
});
