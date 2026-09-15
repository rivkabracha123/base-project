import { deriveHardConstraints, extractBuyerCriteriaFromFixture } from './buyer-criteria';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { week3P4Fixtures, week4IntegrationTrace } from './buyer-criteria.test-helpers';
import { criteriaToSearchRequest } from './criteria-to-search-request';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';

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
      filters: {
        categories: ['painting'],
        price: { min: 10000, max: 10000, currency: 'USD' },
      },
    });
    expect(session.conversation.missing).toEqual(['location']);
    expect(criteria.hardConstraints.length).toBeGreaterThan(0);
  });

  it('traces the Week 4 named fixture through extract, turn, and B3 handoff', async () => {
    const first = service.extractFromFixture(week4IntegrationTrace.p4);
    service.processTurn({
      id: 'buyer-trace',
      sessionId: first.sessionId,
      speaker: 'buyer',
      skipped: false,
      text: week4IntegrationTrace.turnMessage,
      date: buyerAt,
    });
    const criteria = service.getCriteriaForSession(first.sessionId);
    const extracted = extractBuyerCriteriaFromFixture(week4IntegrationTrace.p4);

    const p2 = {
      search: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 }),
    };
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
    expect(criteria.creators).toEqual([week4IntegrationTrace.turnMessage]);
    expect(criteria.hardConstraints).toEqual(deriveHardConstraints(criteria));

    expect(outcome.kind).toBe('unmatched');
    if (outcome.kind !== 'unmatched') return;
    expect(outcome.view.unmatchedDemand.searchRequest.hardConstraints).toEqual(criteria.hardConstraints);
    expect(outcome.view.unmatchedDemand.searchRequest.criteria.price).toEqual(extracted.criteria.price);
  });
});
