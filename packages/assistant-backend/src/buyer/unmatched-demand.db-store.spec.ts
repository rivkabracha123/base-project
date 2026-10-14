import type { Repository } from 'typeorm';
import type { BuyerUnmatchedDemandEntity } from '../database/buyer-unmatched-demand.entity';
import { emptyBuyerCriteria } from './buyer-criteria';
import { BuyerSearchOrchestrator, type LotsSearchClient } from './buyer-search.orchestrator';
import { buildDemandSummary } from './explained-results';
import { createUnmatchedDemandDashboardView } from './unmatched-demand-dashboard-view';
import { UnmatchedDemandDbStore } from './unmatched-demand.db-store';

// Fake buyer_unmatched_demand repository: rows keyed by lead id, saved as plain JSON like jsonb.
function fakeRepository() {
  const rows = new Map<string, BuyerUnmatchedDemandEntity>();
  const repository = {
    save: jest.fn(async (row: BuyerUnmatchedDemandEntity) => {
      rows.set(row.leadId, JSON.parse(JSON.stringify(row)));
      return row;
    }),
    delete: jest.fn(async ({ leadId }: { leadId: string }) => {
      rows.delete(leadId);
      return { affected: 1, raw: [] };
    }),
    findOneBy: jest.fn(async ({ leadId }: { leadId: string }) => rows.get(leadId) ?? null),
    find: jest.fn(async () =>
      [...rows.values()].sort((a, b) => String(b.searchedAt).localeCompare(String(a.searchedAt))),
    ),
  };
  return { rows, repository: repository as unknown as Repository<BuyerUnmatchedDemandEntity> };
}

// Builds a no-result view for one lead at one search time.
const viewFor = (id: string, searchedAt: string) => {
  const criteria = { ...emptyBuyerCriteria('en'), categories: ['rare_books'], price: { max: 800, currency: 'USD' } };
  return createUnmatchedDemandDashboardView({
    id,
    status: 'new',
    createdAt: '2026-10-07T09:00:00.000Z',
    searchedAt,
    searchRequest: { criteria, language: 'en', hardConstraints: [] },
    demandSummary: buildDemandSummary(criteria),
  });
};

describe('UnmatchedDemandDbStore', () => {
  it('keeps the latest no-result demand per lead in the database, most recent search first', async () => {
    const { rows, repository } = fakeRepository();
    const store = new UnmatchedDemandDbStore(repository);

    await store.record(viewFor('lead-a', '2026-10-07T09:01:00.000Z'));
    await store.record(viewFor('lead-b', '2026-10-07T09:02:00.000Z'));
    await store.record(viewFor('lead-a', '2026-10-07T09:03:00.000Z'));

    expect(rows.size).toBe(2);
    expect(rows.get('lead-a')).toMatchObject({ leadId: 'lead-a', status: 'new' });
    expect((await store.get('lead-a'))?.unmatchedDemand.searchedAt).toBe('2026-10-07T09:03:00.000Z');
    expect((await store.list()).map((view) => view.id)).toEqual(['lead-a', 'lead-b']);
    expect(await store.get('lead-missing')).toBeUndefined();
  });

  it('removes the demand of the resolved lead only from the database', async () => {
    const { repository } = fakeRepository();
    const store = new UnmatchedDemandDbStore(repository);
    await store.record(viewFor('lead-a', '2026-10-07T09:01:00.000Z'));
    await store.record(viewFor('lead-b', '2026-10-07T09:02:00.000Z'));

    await store.resolve('lead-a');

    expect(await store.get('lead-a')).toBeUndefined();
    expect((await store.list()).map((view) => view.id)).toEqual(['lead-b']);
  });

  it('reads back the same view it saved, budget included, and stores no contact data', async () => {
    const { rows, repository } = fakeRepository();
    const store = new UnmatchedDemandDbStore(repository);
    const view = viewFor('lead-a', '2026-10-07T09:01:00.000Z');

    await store.record(view);

    expect(await store.get('lead-a')).toEqual(view);
    expect(JSON.stringify([...rows.values()])).not.toMatch(/email|phone|contact|conversation/);
  });

  it('has the demand saved by the time the orchestrator returns a no-result', async () => {
    const { repository } = fakeRepository();
    const store = new UnmatchedDemandDbStore(repository);
    const lotsSearch: LotsSearchClient = {
      search: async () => ({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 }),
    };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch, undefined, store);

    const outcome = await orchestrator.search({
      criteria: { ...emptyBuyerCriteria('en'), categories: ['rare_books'] },
      language: 'en',
      leadId: 'lead-db',
      status: 'new',
      createdAt: '2026-10-07T09:00:00.000Z',
      searchedAt: '2026-10-07T09:01:00.000Z',
    });

    expect(outcome.kind).toBe('unmatched');
    if (outcome.kind !== 'unmatched') return;
    expect(await store.get('lead-db')).toEqual(outcome.view);
  });
});
