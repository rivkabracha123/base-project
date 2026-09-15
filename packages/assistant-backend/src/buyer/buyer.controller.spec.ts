import { BuyerController } from './buyer.controller';
import { extractBuyerCriteriaFromFixture } from './buyer-criteria';
import { toBuyerCriteriaB1Response } from './buyer-chat-api';
import { week3P4Fixtures } from './buyer-criteria.test-helpers';

describe('BuyerController', () => {
  const extracted = extractBuyerCriteriaFromFixture(week3P4Fixtures.paintingEn());
  const date = '2026-09-15T09:00:00.000Z';
  const b1AfterExtract = toBuyerCriteriaB1Response('session-1', {
    id: 'system-msg-1',
    speaker: 'system',
    text: extracted.conversation.nextQuestion,
    date,
  });
  const b1AfterTurn = toBuyerCriteriaB1Response('session-1', {
    id: 'system-msg-2',
    speaker: 'system',
    text: 'Is there a place or origin that matters?',
    date,
  });

  it('extractFromFixture delegates to the service', () => {
    const service = { extractFromFixture: jest.fn().mockReturnValue(b1AfterExtract) };
    const controller = new BuyerController(service as never);

    const result = controller.extractFromFixture(week3P4Fixtures.paintingEn());

    expect(result).toBe(b1AfterExtract);
    expect(service.extractFromFixture).toHaveBeenCalledWith(week3P4Fixtures.paintingEn());
  });

  it('processCriteriaTurn delegates buyer messages to the service', () => {
    const turnRequest = {
      id: 'buyer-msg-1',
      sessionId: 'session-1',
      speaker: 'buyer' as const,
      skipped: false as const,
      text: 'Monet',
      date,
    };
    const service = { processTurn: jest.fn().mockReturnValue(b1AfterTurn) };
    const controller = new BuyerController(service as never);

    const result = controller.processCriteriaTurn(turnRequest);

    expect(result).toBe(b1AfterTurn);
    expect(service.processTurn).toHaveBeenCalledWith(turnRequest);
  });

  it('processCriteriaTurn delegates buyer skip to the service', () => {
    const turnRequest = {
      id: 'buyer-msg-skip',
      sessionId: 'session-1',
      speaker: 'buyer' as const,
      skipped: true as const,
      date: '2026-09-15T09:01:00.000Z',
    };
    const b1AfterSkip = toBuyerCriteriaB1Response('session-1', {
      id: 'system-msg-3',
      speaker: 'system',
      text: extracted.conversation.nextQuestion,
      date: '2026-09-15T09:01:00.000Z',
    });
    const service = { processTurn: jest.fn().mockReturnValue(b1AfterSkip) };
    const controller = new BuyerController(service as never);

    const result = controller.processCriteriaTurn(turnRequest);

    expect(result).toBe(b1AfterSkip);
    expect(service.processTurn).toHaveBeenCalledWith(turnRequest);
  });
});
