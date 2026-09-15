import { BuyerCriteriaService } from './buyer-criteria.service';
import { sampleAiExtractResponses } from './buyer-criteria.fixtures';
import { resetBuyerCriteriaSessions } from './buyer-criteria-session.store';

const buyerAt = '2026-09-15T09:00:00.000Z';
const buyerMessageId = 'buyer-msg-1';
const skipMessageId = 'buyer-msg-skip';

describe('Tamar chat API (extract / criteria turn)', () => {
  const service = new BuyerCriteriaService();

  beforeEach(() => {
    service.resetSessionsForTests();
  });

  it('returns a system chat message after extract — Tamar does not receive criteria', () => {
    const response = service.startCriteriaSessionFromAiResponse(sampleAiExtractResponses.paintingEn());

    expect(response).toEqual({
      id: expect.any(String),
      sessionId: expect.any(String),
      speaker: 'system',
      text: 'Is there a specific artist or maker?',
      date: expect.any(String),
    });
    expect(response).not.toHaveProperty('criteria');
    expect(response).not.toHaveProperty('conversation');
  });

  it('stores history when Tamar sends a buyer message back', () => {
    const first = service.startCriteriaSessionFromAiResponse(sampleAiExtractResponses.paintingEn());
    const second = service.continueCriteriaSessionFromChatTurn({
      id: buyerMessageId,
      sessionId: first.sessionId,
      speaker: 'buyer',
      skipped: false,
      text: 'Monet',
      date: buyerAt,
    });

    expect(second.id).toEqual(expect.any(String));
    expect(second.text).toBe('Is there a place or origin that matters?');
    expect(second.speaker).toBe('system');
    expect(service.getCriteriaForSession(first.sessionId).creators).toEqual(['Monet']);
    expect(service.getHistory(first.sessionId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.id,
          speaker: 'system',
          text: 'Is there a specific artist or maker?',
        }),
        expect.objectContaining({
          id: buyerMessageId,
          speaker: 'buyer',
          skipped: false,
          text: 'Monet',
          date: buyerAt,
        }),
        expect.objectContaining({
          id: second.id,
          speaker: 'system',
          text: 'Is there a place or origin that matters?',
        }),
      ]),
    );
  });

  it('treats skipped: true as skip', () => {
    const first = service.startCriteriaSessionFromAiResponse(sampleAiExtractResponses.paintingEn());
    service.continueCriteriaSessionFromChatTurn({
      id: buyerMessageId,
      sessionId: first.sessionId,
      speaker: 'buyer',
      skipped: false,
      text: 'Monet',
      date: buyerAt,
    });
    const afterSkip = service.continueCriteriaSessionFromChatTurn({
      id: skipMessageId,
      sessionId: first.sessionId,
      speaker: 'buyer',
      skipped: true,
      date: '2026-09-15T09:01:00.000Z',
    });

    expect(afterSkip.id).toEqual(expect.any(String));
    expect(afterSkip.text.length).toBeGreaterThan(0);
    expect(service.getSessionResponse(first.sessionId).conversation.skipped).toEqual(['location']);
    expect(service.getSessionResponse(first.sessionId).conversation.missing).toEqual([]);
    expect(service.getHistory(first.sessionId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: skipMessageId,
          speaker: 'buyer',
          skipped: true,
          date: '2026-09-15T09:01:00.000Z',
        }),
      ]),
    );
  });
});
