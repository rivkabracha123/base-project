import { extractBuyerCriteriaFromFixture } from './buyer-criteria';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { week4IntegrationTrace, week4P4HandoffFixtures } from './buyer-criteria.test-helpers';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';

const buyerAt = '2026-09-15T09:00:00.000Z';

describe('B2 Week 4 integration', () => {
  const service = new BuyerCriteriaService();

  beforeEach(() => {
    service.resetSessionsForTests();
  });

  describe('P4 (Shilat) → B2 extract', () => {
    it('maps structuredAnswer into server-side criteria and returns display fields only', () => {
      const response = service.extractFromFixture(week4P4HandoffFixtures.blueRingHe());
      const session = service.getSessionResponse(response.sessionId);

      expect(response.text).toBe('יש טווח תקציב שכדאי להישאר בתוכו?');
      expect(response.speaker).toBe('system');
      expect(response).not.toHaveProperty('criteria');
      expect(session.criteria.categories).toEqual(['טבעות']);
      expect(session.conversation.missing).toContain('budget');
    });

    it('still supports legacy content-only P4 fixtures', () => {
      const response = service.extractFromFixture(week4IntegrationTrace.p4);
      const criteria = service.getCriteriaForSession(response.sessionId);

      expect(criteria.categories).toEqual(['painting']);
      expect(criteria.price).toEqual({ min: 10000, max: 10000, currency: 'USD' });
    });
  });

  describe('B2 session history across turns', () => {
    it('preserves criteria and hardConstraints after answer and skip turns', () => {
      const first = service.extractFromFixture(week4P4HandoffFixtures.blueRingHe());

      service.processTurn({
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

      service.processTurn({
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

  describe('B2 → B3 handoff after refinement', () => {
    it('traces Shilat handoff through turn into B3 with hardConstraints passthrough', async () => {
      const first = service.extractFromFixture(week4P4HandoffFixtures.blueRingHe());
      service.processTurn({
        id: 'buyer-budget',
        sessionId: first.sessionId,
        speaker: 'buyer',
        skipped: false,
        text: '$10000',
        date: buyerAt,
      });
      const criteria = service.getCriteriaForSession(first.sessionId);

      const p2 = {
        search: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 }),
      };
      const orchestrator = new BuyerSearchOrchestrator(p2);
      const outcome = await orchestrator.search({
        criteria,
        language: criteria.language,
        leadId: 'lead-w4-shilat',
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

    it('traces the named Week 4 fixture file through extract, turn, and B3', async () => {
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

      expect(criteria.creators).toEqual([week4IntegrationTrace.turnMessage]);
      expect(criteria.price).toEqual(extracted.criteria.price);

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

      expect(outcome.kind).toBe('unmatched');
      if (outcome.kind !== 'unmatched') return;
      expect(outcome.view.unmatchedDemand.searchRequest.hardConstraints.length).toBeGreaterThan(0);
    });
  });
});
