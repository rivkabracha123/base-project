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

// Builds a no-result view for one lead at one search time, with a budget cap of 800 USD unless given.
const viewFor = (id: string, searchedAt: string, max = 800) => {
  const criteria = { ...emptyBuyerCriteria('en'), categories: ['rare_books'], price: { max, currency: 'USD' } };
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
  it('keeps the original request per lead with a changed later search, most recent search first', async () => {
    const { rows, repository } = fakeRepository();
    const store = new UnmatchedDemandDbStore(repository);

    await store.record(viewFor('lead-a', '2026-10-07T09:01:00.000Z'));
    await store.record(viewFor('lead-b', '2026-10-07T09:02:00.000Z'));
    await store.record(viewFor('lead-a', '2026-10-07T09:03:00.000Z', 1500));

    expect(rows.size).toBe(2);
    expect(rows.get('lead-a')).toMatchObject({ leadId: 'lead-a', status: 'new' });
    const demand = (await store.get('lead-a'))?.unmatchedDemand;
    expect(demand?.searchedAt).toBe('2026-10-07T09:01:00.000Z');
    expect(demand?.searchRequest.criteria.price).toEqual({ max: 800, currency: 'USD' });
    expect(demand?.expansion).toMatchObject({ changedFields: ['price'], searchedAt: '2026-10-07T09:03:00.000Z' });
    expect((await store.list()).map((view) => view.id)).toEqual(['lead-a', 'lead-b']);
    expect(await store.get('lead-missing')).toBeUndefined();
  });

  it('marks the lead found by a later search and keeps its original request', async () => {
    const { repository } = fakeRepository();
    const store = new UnmatchedDemandDbStore(repository);
    await store.record(viewFor('lead-a', '2026-10-07T09:01:00.000Z'));
    const raised = viewFor('lead-a', '2026-10-07T09:05:00.000Z', 1500).unmatchedDemand.searchRequest;
    const found = { searchRequest: raised, relaxedFields: [], searchedAt: '2026-10-07T09:05:00.000Z', resultCount: 2 };

    await store.recordFound({ leadId: 'lead-a', ...found });
    await store.recordFound({ leadId: 'lead-missing', ...found });

    expect((await store.get('lead-a'))?.unmatchedDemand).toMatchObject({
      searchRequest: { criteria: { price: { max: 800, currency: 'USD' } } },
      expansion: { changedFields: ['price'], outcome: 'results', resultCount: 2 },
    });
    expect(await store.get('lead-missing')).toBeUndefined();
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
