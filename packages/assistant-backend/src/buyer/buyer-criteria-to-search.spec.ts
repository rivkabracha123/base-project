import { deriveHardConstraints, parseCriteriaFromAiResponse } from './buyer-criteria';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { sampleAiExtractResponses, refinementExample } from './buyer-criteria.fixtures';
import { criteriaToSearchRequest } from './criteria-to-search-request';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';

const buyerAt = '2026-09-15T09:00:00.000Z';

describe('Pass refined criteria to search (session → orchestrator)', () => {
  const service = new BuyerCriteriaService();

  beforeEach(() => {
    service.resetSessionsForTests();
  });

  it('passes clarified criteria into the lots search request shape', () => {
    const first = service.startCriteriaSessionFromAiResponse(sampleAiExtractResponses.paintingEn());
    service.continueCriteriaSessionFromChat({
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
      query: 'blue',
      language: 'en',
      filters: {
        categories: ['painting'],
        creators: ['Monet'],
        price: { min: 10000, max: 10000, currency: 'USD' },
      },
    });
    expect(session.conversation.missing).toEqual(['location']);
    expect(criteria.hardConstraints.length).toBeGreaterThan(0);
  });

  it('traces a refinement example through session, turn, and search orchestrator', async () => {
    const first = service.startCriteriaSessionFromAiResponse(refinementExample.initialAiResponse);
    service.continueCriteriaSessionFromChat({
      id: 'buyer-trace',
      sessionId: first.sessionId,
      speaker: 'buyer',
      skipped: false,
      text: refinementExample.buyerAnswer,
      date: buyerAt,
    });
    const criteria = service.getCriteriaForSession(first.sessionId);
    const extracted = parseCriteriaFromAiResponse(refinementExample.initialAiResponse);

    const lotsSearch = {
      search: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 }),
    };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);
    const outcome = await orchestrator.search({
      criteria,
      language: criteria.language,
      leadId: 'lead-refinement-trace',
      status: 'new',
      createdAt: '2026-09-14T10:00:00.000Z',
      searchedAt: '2026-09-14T10:01:00.000Z',
    });

    expect(criteria.price).toEqual(extracted.criteria.price);
    expect(criteria.creators).toEqual([refinementExample.buyerAnswer]);
    expect(criteria.hardConstraints).toEqual(deriveHardConstraints(criteria));

    expect(outcome.kind).toBe('unmatched');
    if (outcome.kind !== 'unmatched') return;
    expect(outcome.view.unmatchedDemand.searchRequest.hardConstraints).toEqual(criteria.hardConstraints);
    expect(outcome.view.unmatchedDemand.searchRequest.criteria.price).toEqual(extracted.criteria.price);
  });
});
