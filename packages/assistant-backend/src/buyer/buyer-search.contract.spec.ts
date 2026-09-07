import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuctionLot } from '@monabid/shared';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';

const repoRoot = resolve(__dirname, '../../../..');

const contract = JSON.parse(
  readFileSync(
    resolve(repoRoot, 'fixtures/demo-scenarios/buyer-search-preserved-budget.json'),
    'utf8',
  ),
);

const lots = JSON.parse(
  readFileSync(resolve(repoRoot, 'fixtures/auction-data/lots.json'), 'utf8'),
) as AuctionLot[];

// Looks up a committed fixture lot by id, throwing if it is missing.
const lotById = (id: string): AuctionLot => {
  const lot = lots.find((l) => l.id === id);
  if (!lot) throw new Error(`fixture lot ${id} not found`);
  return lot;
};

const lead = {
  leadId: 'buyer-lead-demo-1',
  status: 'new',
  createdAt: '2026-09-01T10:00:00.000Z',
  searchedAt: '2026-09-01T10:01:00.000Z',
};

const forbiddenKeys = ['profileId', 'sessionId', 'conversation'];

// Week 3 checkpoint: trace one named fixture from B2 criteria + P2 search through B3 into
// B4 results / P5 unmatched demand, with the budget and every hard filter preserved on both sides.
describe('B3 -> B4 / P5 hard-constraint preservation contract', () => {
  const { scenario, expected } = contract;

  it('carries the whole received criteria onto the B4 results handoff', async () => {
    const p2 = {
      searchByText: jest.fn().mockResolvedValue(scenario.p2Results.resultsCase.map(lotById)),
    };
    const orchestrator = new BuyerSearchOrchestrator(p2);

    const outcome = await orchestrator.search({
      criteria: scenario.criteria,
      language: scenario.language,
      ...lead,
    });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.searchRequest.criteria).toEqual(expected.results.searchRequest.criteria);
    expect(outcome.searchRequest.hardConstraints).toEqual([]);
    expect(outcome.items.map((l) => l.id)).toEqual(expected.results.itemIds);

    const serialized = JSON.stringify(outcome);
    for (const key of forbiddenKeys) {
      expect(serialized).not.toContain(key);
    }
  });

  it('carries the whole received criteria onto the P5 unmatched-demand handoff without inventing inventory', async () => {
    const p2 = {
      searchByText: jest.fn().mockResolvedValue(scenario.p2Results.unmatchedCase.map(lotById)),
    };
    const orchestrator = new BuyerSearchOrchestrator(p2);

    const outcome = await orchestrator.search({
      criteria: scenario.criteria,
      language: scenario.language,
      ...lead,
    });

    expect(outcome).toEqual(expected.unmatched);

    const serialized = JSON.stringify(outcome);
    for (const key of forbiddenKeys) {
      expect(serialized).not.toContain(key);
    }
  });

  it('leaves the received budget unchanged on the handoff (no silent relaxation by B3)', async () => {
    const p2 = {
      searchByText: jest.fn().mockResolvedValue(scenario.p2Results.resultsCase.map(lotById)),
    };
    const orchestrator = new BuyerSearchOrchestrator(p2);

    const outcome = await orchestrator.search({
      criteria: scenario.criteria,
      language: scenario.language,
      ...lead,
    });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.searchRequest.criteria.budget).toEqual(scenario.criteria.budget);
  });
});
