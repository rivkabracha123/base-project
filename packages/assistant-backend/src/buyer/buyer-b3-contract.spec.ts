import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deriveHardConstraints, extractBuyerCriteriaFromFixture } from './buyer-criteria';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { week3P4Fixtures } from './buyer-criteria.test-helpers';
import { criteriaToSearchRequest } from './criteria-to-search-request';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';

const traceFixture = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../../fixtures/demo-scenarios/b2-week4-integration-trace.json'),
    'utf8',
  ),
) as {
  p4: ReturnType<typeof week3P4Fixtures.paintingEn>;
  turnMessage: string;
};

const buyerAt = '2026-09-15T09:00:00.000Z';

describe('B2 → B3 criteria contract', () => {
  const service = new BuyerCriteriaService();

  beforeEach(() => {
    service.resetSessionsForTests();
  });

  it('passes clarified criteria into B3 search request shape', () => {
    const first = service.extractFromFixture(week3P4Fixtures.paintingEn());
    service.processTurn({
      id: 'buyer-monet',
      sessionId: first.sessionId,
      speaker: 'buyer',
      skipped: false,
      text: 'Monet',
      date: buyerAt,
    });
    const criteria = service.getCriteriaForSession(first.sessionId);
    const session = service.getSessionResponse(first.sessionId);

    expect(criteriaToSearchRequest(criteria, criteria.language)).toEqual({
      query: 'Monet blue',
      language: 'en',
    });
    expect(session.conversation.missing).toEqual(['location']);
    expect(criteria.hardConstraints.length).toBeGreaterThan(0);
  });

  it('traces the Week 4 named fixture through extract, turn, and B3 handoff', async () => {
    const first = service.extractFromFixture(traceFixture.p4);
    service.processTurn({
      id: 'buyer-trace',
      sessionId: first.sessionId,
      speaker: 'buyer',
      skipped: false,
      text: traceFixture.turnMessage,
      date: buyerAt,
    });
    const criteria = service.getCriteriaForSession(first.sessionId);
    const extracted = extractBuyerCriteriaFromFixture(traceFixture.p4);

    const p2 = { searchByText: jest.fn().mockResolvedValue([]) };
    const orchestrator = new BuyerSearchOrchestrator(p2);
    const outcome = await orchestrator.search({
      criteria,
      language: criteria.language,
      leadId: 'lead-w4-trace',
      status: 'new',
      createdAt: '2026-09-14T10:00:00.000Z',
      searchedAt: '2026-09-14T10:01:00.000Z',
    });

    expect(criteria.price).toEqual(extracted.criteria.price);
    expect(criteria.creators).toEqual([traceFixture.turnMessage]);
    expect(criteria.hardConstraints).toEqual(deriveHardConstraints(criteria));

    expect(outcome.kind).toBe('unmatched');
    if (outcome.kind !== 'unmatched') return;
    expect(outcome.view.unmatchedDemand.searchRequest.hardConstraints).toEqual(criteria.hardConstraints);
    expect(outcome.view.unmatchedDemand.searchRequest.criteria.price).toEqual(extracted.criteria.price);
  });
});
