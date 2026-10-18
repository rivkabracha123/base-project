import { buildDemandSummary } from './explained-results';
import { emptyBuyerCriteria } from './buyer-criteria';
import { createUnmatchedDemandDashboardView } from './unmatched-demand-dashboard-view';
import { UnmatchedDemandStore } from './unmatched-demand.store';

// Builds a no-result view for one lead at one search time, with an optional budget cap.
const viewFor = (id: string, searchedAt: string, max?: number) => {
  const criteria = {
    ...emptyBuyerCriteria('en'),
    categories: ['rare_books'],
    ...(max != null ? { price: { max, currency: 'USD' } } : {}),
  };
  return createUnmatchedDemandDashboardView({
    id,
    status: 'new',
    createdAt: '2026-10-06T09:00:00.000Z',
    searchedAt,
    searchRequest: { criteria, language: 'en', hardConstraints: [] },
    demandSummary: buildDemandSummary(criteria),
  });
};

describe('UnmatchedDemandStore', () => {
  it('keeps the first no-result request per lead and adds a changed later one as its expansion', () => {
    const store = new UnmatchedDemandStore();
    store.record(viewFor('lead-a', '2026-10-06T09:01:00.000Z', 500));
    store.record(viewFor('lead-b', '2026-10-06T09:02:00.000Z'));
    store.record(viewFor('lead-a', '2026-10-06T09:03:00.000Z', 900));

    const demand = store.get('lead-a')?.unmatchedDemand;
    expect(demand?.searchedAt).toBe('2026-10-06T09:01:00.000Z');
    expect(demand?.searchRequest.criteria.price).toEqual({ max: 500, currency: 'USD' });
    expect(demand?.expansion).toMatchObject({
      changedFields: ['price'],
      searchedAt: '2026-10-06T09:03:00.000Z',
      outcome: 'no_results',
    });
    expect(demand?.expansion?.searchRequest.criteria.price).toEqual({ max: 900, currency: 'USD' });
    expect(store.list().map((view) => view.id)).toEqual(['lead-a', 'lead-b']);
    expect(store.get('lead-missing')).toBeUndefined();
  });

  it('adds no expansion when the same request is searched again', () => {
    const store = new UnmatchedDemandStore();
    const first = viewFor('lead-a', '2026-10-06T09:01:00.000Z', 500);
    store.record(first);
    store.record(viewFor('lead-a', '2026-10-06T09:03:00.000Z', 500));

    expect(store.get('lead-a')).toEqual(first);
  });

  it('marks only a lead with recorded demand as found by its later search', () => {
    const store = new UnmatchedDemandStore();
    store.record(viewFor('lead-a', '2026-10-06T09:01:00.000Z', 500));
    const raised = viewFor('lead-a', '2026-10-06T09:04:00.000Z', 900).unmatchedDemand.searchRequest;
    const found = { searchRequest: raised, relaxedFields: [], searchedAt: '2026-10-06T09:04:00.000Z', resultCount: 3 };

    store.recordFound({ leadId: 'lead-a', ...found });
    store.recordFound({ leadId: 'lead-missing', ...found });

    expect(store.get('lead-a')?.unmatchedDemand).toMatchObject({
      searchRequest: { criteria: { price: { max: 500, currency: 'USD' } } },
      expansion: { changedFields: ['price'], outcome: 'results', resultCount: 3 },
    });
    expect(store.list().map((view) => view.id)).toEqual(['lead-a']);
  });
});
