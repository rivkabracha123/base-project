import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/auction-data/lots.json'), 'utf8'),
) as Array<Record<string, unknown>>;

describe('BuyerSearchOrchestrator', () => {
  it('traces a named fixture from criteria through P2 to a B4-consumable result list', async () => {
    const p2 = {
      searchByText: jest.fn().mockResolvedValue(fixture),
    };
    const orchestrator = new BuyerSearchOrchestrator(p2);

    const outcome = await orchestrator.search({
      criteria: { creator: 'Yitzhak Abrabanel', keywords: ['manuscript'], missing: [] },
      language: 'en',
      leadId: 'lead-results-1',
      status: 'new',
      createdAt: '2026-09-01T10:00:00.000Z',
      searchedAt: '2026-09-01T10:01:00.000Z',
    });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.searchRequest).toEqual({
      query: 'Yitzhak Abrabanel manuscript',
      language: 'en',
    });
    expect(outcome.items).toEqual(fixture);
    expect(p2.searchByText).toHaveBeenCalledWith('Yitzhak Abrabanel manuscript', 'en');
  });

  it('records an honest no-result request for P5 without inventing inventory or private data', async () => {
    const p2 = { searchByText: jest.fn().mockResolvedValue([]) };
    const orchestrator = new BuyerSearchOrchestrator(p2);
    const criteria = {
      creator: 'Yitzhak Abrabanel',
      budget: { min: 1000, max: 15000 },
      missing: [],
    };

    const outcome = await orchestrator.search({
      criteria,
      language: 'he',
      leadId: 'lead-unmatched-1',
      status: 'new',
      createdAt: '2026-09-01T10:00:00.000Z',
      searchedAt: '2026-09-01T10:01:00.000Z',
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
});
