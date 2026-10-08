import { emptyBuyerCriteria } from './buyer-criteria';
import { buildDemandSummary } from './explained-results';
import { createUnmatchedDemandDashboardView } from './unmatched-demand-dashboard-view';

describe('createUnmatchedDemandDashboardView', () => {
  it('wraps the full buyer request and demand summary for the staff dashboard without private conversation data', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['rare_books'];
    criteria.creators = ['Yitzhak Abrabanel'];

    const searchRequest = {
      criteria,
      language: 'en' as const,
      hardConstraints: [],
    };
    const demandSummary = buildDemandSummary(criteria);

    expect(
      createUnmatchedDemandDashboardView({
        id: 'demand-1',
        status: 'new',
        createdAt: '2026-09-01T10:00:00.000Z',
        searchedAt: '2026-09-01T10:01:00.000Z',
        searchRequest,
        demandSummary,
      }),
    ).toEqual({
      id: 'demand-1',
      type: 'buyer',
      status: 'new',
      createdAt: '2026-09-01T10:00:00.000Z',
      unmatchedDemand: {
        searchRequest,
        reason: 'no_results',
        searchedAt: '2026-09-01T10:01:00.000Z',
        demandSummary,
      },
    });
  });
});
