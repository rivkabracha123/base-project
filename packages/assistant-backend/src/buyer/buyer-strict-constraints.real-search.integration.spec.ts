import * as fs from 'node:fs';
import { resolve } from 'node:path';
import type { AuctionLot } from '@monabid/shared';
import type { Repository } from 'typeorm';
import type { AuctionLotEntity } from '../database/auction-lot.entity';
import { LotsService } from '../lots/lots.service';
import type { ApprovedRelaxation, RelaxableField } from './approved-relaxation';
import { emptyBuyerCriteria, mergeBuyerCriteria, type BuyerCriteria } from './buyer-criteria';
import { toBuyerSearchStatusMessage } from './buyer-search-status-message';
import {
  BuyerSearchOrchestrator,
  type BuyerSearchOutcome,
  type BuyerSearchProgress,
  type LotsSearchClient,
} from './buyer-search.orchestrator';
import { InvalidLotsSearchRequestError, LotsServiceSearchClient } from './lots-service-search.client';
import type { SearchRequest } from './search-request';
import { UnmatchedDemandStore } from './unmatched-demand.store';

// Wraps readFileSync so the boundary test can prove no raw source file is read during a search.
jest.mock('node:fs', () => {
  const actual = jest.requireActual<typeof import('node:fs')>('node:fs');
  return { ...actual, readFileSync: jest.fn(actual.readFileSync) };
});

// Strict constraints, no results, invalid input and refinement, measured end to end: buyer criteria
// through the real request validation and LotsService (only the DB repository is faked) into the
// result cards hand-off or the recorded staff demand. Scenarios and measured results live in the fixture.
const readJson = <T>(path: string): T =>
  JSON.parse(fs.readFileSync(resolve(__dirname, '../../../../', path), 'utf8')) as T;

interface Scenario {
  name: string;
  language: 'en' | 'he';
  criteria: Partial<BuyerCriteria>;
  approvedRelaxations?: RelaxableField[];
  expected: {
    request: SearchRequest | null;
    kind: BuyerSearchOutcome['kind'] | 'error';
    lotIds?: string[];
    approvedRefinements?: RelaxableField[];
    relaxationOptions?: RelaxableField[];
    appliedCriteria?: string[];
    recovery?: string;
    invalidFields?: string[];
    demandRecorded?: boolean;
  };
}

const contract = readJson<{ lotsSource: string; namedLotId: string; scenarios: Scenario[] }>(
  'fixtures/demo-scenarios/buyer-search-strict-constraints.json',
);
const lots = readJson<AuctionLot[]>(contract.lotsSource);
const approvedAt = '2026-10-11T10:00:00.000Z';

// Fake DB layer for the real LotsService: applies the bound filter parameters to the committed lots
// and returns them in the lots search's documented order (newest sale first, then lot id).
function fakeLotsRepository(failWith?: Error) {
  const createQueryBuilder = jest.fn(() => {
    const params: Record<string, unknown> = {};
    let matched: AuctionLot[] = [];
    const qb: Record<string, jest.Mock> = {
      andWhere: jest.fn((_clause: string, bound?: Record<string, unknown>) => {
        Object.assign(params, bound);
        return qb;
      }),
      orderBy: jest.fn(() => qb),
      addOrderBy: jest.fn(() => qb),
      addSelect: jest.fn(() => qb),
      setParameters: jest.fn(() => qb),
      select: jest.fn(() => qb),
      where: jest.fn(() => qb),
      skip: jest.fn(() => qb),
      take: jest.fn(() => qb),
      getRawMany: jest.fn(async () => []),
      getRawAndEntities: jest.fn(async () => {
        if (failWith) throw failWith;
        if ('query' in params) throw new Error('fake repository does not emulate free-text search');
        const inList = (key: string, value: unknown) =>
          !(key in params) || (params[key] as unknown[]).includes(value);
        const amount = (lot: AuctionLot) => lot.realizedPrice?.amount ?? Number.NaN;
        matched = lots
          .filter((lot) => inList('categories', lot.category))
          .filter((lot) => inList('creators', (lot as { creator?: string }).creator))
          .filter((lot) => inList('auctionHouseIds', lot.auctionHouse.id))
          .filter((lot) => params.priceMin == null || amount(lot) >= (params.priceMin as number))
          .filter((lot) => params.priceMax == null || amount(lot) <= (params.priceMax as number))
          .filter((lot) => params.dateFrom == null || lot.saleDate >= (params.dateFrom as string))
          .filter((lot) => params.dateTo == null || lot.saleDate <= (params.dateTo as string))
          .sort((a, b) => b.saleDate.localeCompare(a.saleDate) || a.id.localeCompare(b.id));
        return { entities: matched.map((payload) => ({ payload })), raw: [] };
      }),
      getCount: jest.fn(async () => matched.length),
    };
    return qb;
  });
  return { createQueryBuilder } as unknown as Repository<AuctionLotEntity>;
}

// Wires the orchestrator to the real client and LotsService, recording every request sent.
function wire(failWith?: Error) {
  const client = new LotsServiceSearchClient(new LotsService(fakeLotsRepository(failWith)));
  const requests: SearchRequest[] = [];
  const lotsSearch: LotsSearchClient = {
    search: (request) => {
      requests.push(request);
      return client.search(request);
    },
  };
  const demandStore = new UnmatchedDemandStore();
  const orchestrator = new BuyerSearchOrchestrator(lotsSearch, undefined, demandStore);
  return { orchestrator, requests, demandStore };
}

const criteriaOf = (scenario: Scenario): BuyerCriteria => ({
  ...emptyBuyerCriteria(scenario.language),
  ...scenario.criteria,
});

const approvals = (fields: RelaxableField[] = []): ApprovedRelaxation[] =>
  fields.map((field) => ({ field, approvedAt }));

// Runs one scenario; a thrown error is returned as the outcome so failures can be measured too.
async function runScenario(scenario: Scenario, approved = scenario.approvedRelaxations) {
  const wired = wire();
  const progress: BuyerSearchProgress[] = [];
  const outcome = await wired.orchestrator
    .search(
      {
        criteria: criteriaOf(scenario),
        language: scenario.language,
        leadId: `buyer-lead-${scenario.name}`,
        status: 'new',
        createdAt: '2026-10-11T09:00:00.000Z',
        searchedAt: '2026-10-11T09:01:00.000Z',
        approvedRelaxations: approvals(approved),
      },
      (update) => progress.push(update),
    )
    .catch((error: Error) => error);
  return { ...wired, outcome, progress };
}

const handedLotIds = (outcome: BuyerSearchOutcome) =>
  outcome.kind === 'results'
    ? [...outcome.results.current, ...outcome.results.historical].map((entry) => entry.lot.id)
    : [];

describe('Buyer search strict constraints: measured fixture scenarios', () => {
  it.each(contract.scenarios.map((scenario) => [scenario.name, scenario] as const))(
    '%s matches its recorded request and measured outcome',
    async (_name, scenario) => {
      const { outcome, requests, demandStore } = await runScenario(scenario);
      const { expected } = scenario;

      expect(requests).toEqual(expected.request ? [expected.request] : []);
      expect(demandStore.list().length > 0).toBe(expected.demandRecorded ?? false);

      if (expected.kind === 'error') {
        expect(outcome).toBeInstanceOf(InvalidLotsSearchRequestError);
        expect((outcome as InvalidLotsSearchRequestError).fields).toEqual(expected.invalidFields);
        return;
      }
      if (outcome instanceof Error) throw outcome;
      expect(outcome.kind).toBe(expected.kind);
      // The buyer's own criteria come back exactly as given, whatever this search ran without.
      expect(outcome.kind === 'unmatched' ? outcome.view.unmatchedDemand.searchRequest.criteria : outcome.searchRequest.criteria).toEqual(criteriaOf(scenario));

      if (outcome.kind === 'results') {
        expect(handedLotIds(outcome)).toEqual(expected.lotIds);
        expect(outcome.approvedRefinements).toEqual(expected.approvedRefinements);
      }
      if (outcome.kind === 'unmatched') {
        expect(outcome.relaxationOptions.map((option) => option.field)).toEqual(expected.relaxationOptions);
        expect(outcome.relaxationOptions.every((option) => option.requiresApproval)).toBe(true);
        expect(outcome.view.unmatchedDemand.demandSummary).toMatchObject({
          appliedCriteria: expected.appliedCriteria,
          recovery: expected.recovery,
        });
      }
    },
  );

  it('sends the budget exactly as given in every scenario unless the buyer approved dropping it', async () => {
    for (const scenario of contract.scenarios) {
      const { requests } = await runScenario(scenario);
      const price = scenario.criteria.price;
      const sent = requests[0]?.filters?.price;
      if (scenario.approvedRelaxations?.includes('price') || !price) expect(sent).toBeUndefined();
      else expect(sent).toEqual(price);
    }
  });

  it('hands the named lot to the result cards unmodified, with no price reason once the budget was dropped', async () => {
    const scenario = contract.scenarios.find((entry) => entry.name === 'approved-budget-relaxation')!;
    const { outcome } = await runScenario(scenario);
    if (outcome instanceof Error || outcome.kind !== 'results') throw new Error('expected results');

    const named = outcome.results.historical.find((entry) => entry.lot.id === contract.namedLotId)!;
    expect(named.lot).toEqual(lots.find((lot) => lot.id === contract.namedLotId));
    expect(named.matchReasons.map((reason) => reason.field)).not.toContain('price');
  });
});

describe('Buyer search deterministic behavior', () => {
  it('returns an identical outcome and request when every scenario runs twice', async () => {
    for (const scenario of contract.scenarios) {
      const first = await runScenario(scenario);
      const second = await runScenario(scenario);
      expect(second.requests).toEqual(first.requests);
      expect(second.outcome).toEqual(first.outcome);
      expect(second.progress).toEqual(first.progress);
    }
  });

  it('builds the same request and refinement list whatever order the buyer approved filters in', async () => {
    const scenario: Scenario = {
      name: 'approval-order',
      language: 'en',
      criteria: { categories: ['rare_books'], auctionHouseIds: ['house-kestenbaum'], price: { min: 100, max: 500 } },
      expected: { request: null, kind: 'results' },
    };
    const forward = await runScenario(scenario, ['price', 'auctionHouseIds']);
    const backward = await runScenario(scenario, ['auctionHouseIds', 'price']);

    expect(backward.requests).toEqual(forward.requests);
    expect(backward.outcome).toEqual(forward.outcome);
    expect((forward.outcome as BuyerSearchOutcome & { kind: 'results' }).approvedRefinements).toEqual([
      'auctionHouseIds',
      'price',
    ]);
  });

  it('keeps the lots search order in the hand-off and never re-ranks or adds lots', async () => {
    const scenario = contract.scenarios.find((entry) => entry.name === 'approved-budget-relaxation')!;
    const { outcome } = await runScenario(scenario);
    const ranked = [...lots]
      .sort((a, b) => b.saleDate.localeCompare(a.saleDate) || a.id.localeCompare(b.id))
      .map((lot) => lot.id);

    expect(handedLotIds(outcome as BuyerSearchOutcome)).toEqual(ranked);
  });
});

describe('Buyer search repeated refinement', () => {
  it('keeps the tightened budget through five turns, with each approval covering one search only', async () => {
    const { orchestrator, requests } = wire();
    const turn = (criteria: BuyerCriteria, approved?: RelaxableField[]) =>
      orchestrator.search({
        criteria,
        language: 'en',
        leadId: 'buyer-lead-repeated-refinement',
        status: 'new',
        createdAt: '2026-10-11T09:00:00.000Z',
        searchedAt: '2026-10-11T09:01:00.000Z',
        approvedRelaxations: approvals(approved),
      });
    const tightened = { min: 900, max: 1000, currency: 'USD' };

    const first = criteriaOf(contract.scenarios[0]!);
    expect(handedLotIds(await turn(first))).toEqual(['lot-kestenbaum-54554-121421', 'lot-kedem-61201-88421']);

    // A budget answer replaces the previous budget whole, so the tightened range is sent in full.
    const second = mergeBuyerCriteria(first, { price: tightened });
    expect(second.price).toEqual(tightened);
    expect(handedLotIds(await turn(second))).toEqual(['lot-kedem-61201-88421']);

    const third = mergeBuyerCriteria(second, { auctionHouseIds: ['house-kestenbaum'] });
    const noResult = await turn(third);
    expect(noResult.kind).toBe('unmatched');
    if (noResult.kind !== 'unmatched') return;
    expect(noResult.view.unmatchedDemand.demandSummary.hardConstraints).toContainEqual(
      expect.objectContaining({ field: 'price', value: tightened }),
    );

    const relaxed = await turn(third, ['price']);
    expect(handedLotIds(relaxed)).toEqual(['lot-kestenbaum-54554-121421', 'lot-kestenbaum-54554-121488']);
    expect(relaxed.kind === 'results' && relaxed.searchRequest.criteria.price).toEqual(tightened);

    expect((await turn(third)).kind).toBe('unmatched');
    expect(requests.map((request) => request.filters?.price)).toEqual([
      first.price,
      tightened,
      tightened,
      undefined,
      tightened,
    ]);
  });
});

describe('Buyer search service failure', () => {
  it('reports an error and records no demand when the lots database fails', async () => {
    const failure = new Error('connection refused');
    const { orchestrator, demandStore } = wire(failure);
    const progress: BuyerSearchProgress[] = [];

    await expect(
      orchestrator.search(
        {
          criteria: criteriaOf(contract.scenarios[0]!),
          language: 'en',
          leadId: 'buyer-lead-db-down',
          status: 'new',
          createdAt: '2026-10-11T09:00:00.000Z',
          searchedAt: '2026-10-11T09:01:00.000Z',
        },
        (update) => progress.push(update),
      ),
    ).rejects.toBe(failure);

    expect(progress).toEqual([{ stage: 'searching' }, { stage: 'error' }]);
    expect(demandStore.list()).toEqual([]);
  });

  it('reports an error, not a no-result, for input the lots search rejects', async () => {
    const scenario = contract.scenarios.find((entry) => entry.name === 'invalid-negative-budget')!;
    const { progress, demandStore } = await runScenario(scenario);

    expect(progress).toEqual([{ stage: 'searching' }, { stage: 'error' }]);
    expect(demandStore.list()).toEqual([]);
  });
});

describe('Buyer search privacy', () => {
  it('records demand with only the lead id, status, times and the search request, no conversation or contact data', async () => {
    for (const scenario of contract.scenarios.filter((entry) => entry.expected.kind === 'unmatched')) {
      const { outcome } = await runScenario(scenario);
      if (outcome instanceof Error || outcome.kind !== 'unmatched') throw new Error('expected unmatched');

      expect(Object.keys(outcome.view).sort()).toEqual(['createdAt', 'id', 'status', 'type', 'unmatchedDemand']);
      expect(Object.keys(outcome.view.unmatchedDemand).sort()).toEqual([
        'demandSummary',
        'reason',
        'searchRequest',
        'searchedAt',
      ]);
      expect(JSON.stringify(outcome.view)).not.toMatch(/email|phone|contact|message|transcript|password|token/i);
    }
  });

  it('carries no lot data in progress updates and no buyer values in rejection errors', async () => {
    for (const scenario of contract.scenarios) {
      const { outcome, progress } = await runScenario(scenario);
      expect(JSON.stringify(progress)).not.toContain('lot-');
      if (outcome instanceof InvalidLotsSearchRequestError) {
        expect(outcome.message).not.toMatch(/-100|2025-13-40/);
      }
    }
  });
});

describe('Buyer search status text accessibility', () => {
  it('gives every outcome a non-empty plain-text status in the buyer language', async () => {
    for (const scenario of contract.scenarios.filter((entry) => entry.expected.kind !== 'error')) {
      const { outcome } = await runScenario(scenario);
      if (outcome instanceof Error) throw outcome;
      for (const language of ['he', 'en'] as const) {
        const { text } = toBuyerSearchStatusMessage(outcome, { language, criteria: criteriaOf(scenario) });
        expect(text.trim().length).toBeGreaterThan(0);
        expect(text).not.toMatch(/[<>]/);
        expect(/[֐-׿]/.test(text)).toBe(language === 'he');
      }
    }
  });
});

describe('Buyer search boundary', () => {
  it('reads lots only through the lots search, never from a raw source file', async () => {
    const readSync = fs.readFileSync as jest.Mock;
    readSync.mockClear();
    for (const scenario of contract.scenarios) await runScenario(scenario);
    expect(readSync).not.toHaveBeenCalled();
  });
});
