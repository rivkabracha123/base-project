import { buildDemandSummary } from './explained-results';
import { emptyBuyerCriteria } from './buyer-criteria';
import { createUnmatchedDemandDashboardView } from './unmatched-demand-dashboard-view';
import { UnmatchedDemandStore } from './unmatched-demand.store';

// Builds a no-result view for one lead at one search time.
const viewFor = (id: string, searchedAt: string) => {
  const criteria = { ...emptyBuyerCriteria('en'), categories: ['rare_books'] };
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
  it('keeps the latest no-result demand per lead for staff to read', () => {
    const store = new UnmatchedDemandStore();
    store.record(viewFor('lead-a', '2026-10-06T09:01:00.000Z'));
    store.record(viewFor('lead-b', '2026-10-06T09:02:00.000Z'));
    store.record(viewFor('lead-a', '2026-10-06T09:03:00.000Z'));

    expect(store.get('lead-a')?.unmatchedDemand.searchedAt).toBe('2026-10-06T09:03:00.000Z');
    expect(store.list().map((view) => view.id)).toEqual(['lead-a', 'lead-b']);
    expect(store.get('lead-missing')).toBeUndefined();
  });
});
