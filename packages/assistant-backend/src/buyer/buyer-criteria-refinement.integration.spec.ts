import { parseCriteriaFromAiResponse } from './buyer-criteria';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { refinementExample, structuredAiExtractSamples } from './buyer-criteria.fixtures';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';

const buyerAt = '2026-09-15T09:00:00.000Z';

describe('Criteria refinement across chat and search', () => {
  const service = new BuyerCriteriaService();

  beforeEach(() => {
    service.resetSessionsForTests();
  });

  describe('Start session from AI extract response', () => {
    it('maps structuredAnswer into server-side criteria and returns display fields only', () => {
      const response = service.startCriteriaSessionFromAiResponse(structuredAiExtractSamples.blueRingHe());
      const session = service.getSessionResponse(response.sessionId);

      expect(response.text).toBe('יש טווח תקציב שכדאי להישאר בתוכו?');
      expect(response.speaker).toBe('system');
      expect(response).not.toHaveProperty('criteria');
      expect(session.criteria.categories).toEqual(['טבעות']);
      expect(session.conversation.missing).toContain('budget');
    });

    it('still supports legacy content-only AI extract fixtures', () => {
      const response = service.startCriteriaSessionFromAiResponse(refinementExample.initialAiResponse);
      const criteria = service.getCriteriaForSession(response.sessionId);

      expect(criteria.categories).toEqual(['painting']);
      expect(criteria.price).toEqual({ min: 10000, max: 10000, currency: 'USD' });
    });
  });

  describe('Session history across clarification turns', () => {
    it('preserves criteria and hardConstraints after answer and skip turns', () => {
      const first = service.startCriteriaSessionFromAiResponse(structuredAiExtractSamples.blueRingHe());

      service.continueCriteriaSessionFromChat({
        id: 'buyer-budget',
        sessionId: first.sessionId,
        speaker: 'buyer',
        skipped: false,
        text: '$10000',
        date: buyerAt,
      });
      const afterBudget = service.getCriteriaForSession(first.sessionId);

      expect(afterBudget.price).toEqual({ min: 10000, max: 10000, currency: 'USD' });
      expect(afterBudget.hardConstraints).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'price', operator: 'range' })]),
      );

      service.continueCriteriaSessionFromChat({
        id: 'buyer-skip',
        sessionId: first.sessionId,
        speaker: 'buyer',
        skipped: true,
        date: '2026-09-15T09:01:00.000Z',
      });
      const afterSkip = service.getSessionResponse(first.sessionId);

      expect(afterSkip.conversation.skipped).toContain('creator');
      expect(afterSkip.criteria.categories).toEqual(['טבעות']);
      expect(afterSkip.criteria.price).toEqual(afterBudget.price);
      expect(service.getHistory(first.sessionId)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ speaker: 'buyer', skipped: true, date: '2026-09-15T09:01:00.000Z' }),
        ]),
      );
    });
  });

  describe('Search after criteria refinement', () => {
    it('passes hardConstraints through to the search orchestrator', async () => {
      const first = service.startCriteriaSessionFromAiResponse(structuredAiExtractSamples.blueRingHe());
      service.continueCriteriaSessionFromChat({
        id: 'buyer-budget',
        sessionId: first.sessionId,
        speaker: 'buyer',
        skipped: false,
        text: '$10000',
        date: buyerAt,
      });
      const criteria = service.getCriteriaForSession(first.sessionId);

      const lotsSearch = {
        search: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 }),
      };
      const orchestrator = new BuyerSearchOrchestrator(lotsSearch);
      const outcome = await orchestrator.search({
        criteria,
        language: criteria.language,
        leadId: 'lead-refinement-demo',
        status: 'new',
        createdAt: '2026-09-14T10:00:00.000Z',
        searchedAt: '2026-09-14T10:01:00.000Z',
      });

      expect(criteria.hardConstraints.length).toBeGreaterThan(0);
      expect(outcome.kind).toBe('unmatched');
      if (outcome.kind !== 'unmatched') return;

      expect(outcome.view.unmatchedDemand.searchRequest.hardConstraints).toEqual(
        criteria.hardConstraints,
      );
      expect(outcome.view.unmatchedDemand.searchRequest.criteria.categories).toEqual(['טבעות']);
    });

    it('traces a named refinement example through extract, turn, and search', async () => {
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

      expect(criteria.creators).toEqual([refinementExample.buyerAnswer]);
      expect(criteria.price).toEqual(extracted.criteria.price);

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

      expect(outcome.kind).toBe('unmatched');
      if (outcome.kind !== 'unmatched') return;
      expect(outcome.view.unmatchedDemand.searchRequest.hardConstraints.length).toBeGreaterThan(0);
    });
  });
});
