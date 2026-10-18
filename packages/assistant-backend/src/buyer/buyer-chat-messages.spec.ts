import { BuyerCriteriaService } from './buyer-criteria.service';
import { sampleAiExtractResponses } from './buyer-criteria.fixtures';
import { resetBuyerCriteriaSessions } from './buyer-criteria-session.store';

const buyerMessageId = 'buyer-msg-1';
const skipMessageId = 'buyer-msg-skip';

describe('Chat messages for extract and clarification turns', () => {
  const service = new BuyerCriteriaService();

  beforeEach(() => {
    service.resetSessionsForTests();
  });

  it('returns a system chat message after extract without exposing stored criteria', () => {
    const response = service.startCriteriaSessionFromAiResponse(sampleAiExtractResponses.paintingEn());

    expect(response).toEqual({
      id: expect.any(String),
      sessionId: expect.any(String),
      speaker: 'system',
      text: 'Is there a specific artist or maker?',
    });
    expect(response).not.toHaveProperty('criteria');
    expect(response).not.toHaveProperty('conversation');
  });

  it('stores history when the chat UI sends a buyer message back', () => {
    const first = service.startCriteriaSessionFromAiResponse(sampleAiExtractResponses.paintingEn());
    const second = service.continueCriteriaSessionFromChat({
      id: buyerMessageId,
      sessionId: first.sessionId,
      speaker: 'buyer',
      skipped: false,
      text: 'Monet',
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
    service.continueCriteriaSessionFromChat({
      id: buyerMessageId,
      sessionId: first.sessionId,
      speaker: 'buyer',
      skipped: false,
      text: 'Monet',
    });
    const afterSkip = service.continueCriteriaSessionFromChat({
      id: skipMessageId,
      sessionId: first.sessionId,
      speaker: 'buyer',
      skipped: true,
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
        }),
      ]),
    );
  });
});
