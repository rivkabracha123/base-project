import { BuyerController } from './buyer.controller';
import { parseCriteriaFromHandoff } from './buyer-criteria';
import { toBuyerChatSystemMessage } from './buyer-chat-api';
import { sampleHandoffResponses } from './buyer-criteria.fixtures';

describe('BuyerController', () => {
  const extracted = parseCriteriaFromHandoff(sampleHandoffResponses.paintingEn());
  const date = '2026-09-15T09:00:00.000Z';
  const systemMessageAfterExtract = toBuyerChatSystemMessage('session-1', {
    id: 'system-msg-1',
    speaker: 'system',
    text: extracted.conversation.nextQuestion,
    date,
  });
  const systemMessageAfterTurn = toBuyerChatSystemMessage('session-1', {
    id: 'system-msg-2',
    speaker: 'system',
    text: 'Is there a place or origin that matters?',
    date,
  });

  it('startCriteriaSession delegates to the service', () => {
    const service = { startCriteriaSessionFromHandoff: jest.fn().mockReturnValue(systemMessageAfterExtract) };
    const controller = new BuyerController(service as never);

    const result = controller.startCriteriaSession(sampleHandoffResponses.paintingEn());

    expect(result).toBe(systemMessageAfterExtract);
    expect(service.startCriteriaSessionFromHandoff).toHaveBeenCalledWith(sampleHandoffResponses.paintingEn());
  });

  it('continueCriteriaSession delegates buyer messages to the service', () => {
    const turnRequest = {
      id: 'buyer-msg-1',
      sessionId: 'session-1',
      speaker: 'buyer' as const,
      skipped: false as const,
      text: 'Monet',
      date,
    };
    const service = { continueCriteriaSessionFromChatTurn: jest.fn().mockReturnValue(systemMessageAfterTurn) };
    const controller = new BuyerController(service as never);

    const result = controller.continueCriteriaSession(turnRequest);

    expect(result).toBe(systemMessageAfterTurn);
    expect(service.continueCriteriaSessionFromChatTurn).toHaveBeenCalledWith(turnRequest);
  });

  it('continueCriteriaSession delegates buyer skip to the service', () => {
    const turnRequest = {
      id: 'buyer-msg-skip',
      sessionId: 'session-1',
      speaker: 'buyer' as const,
      skipped: true as const,
      date: '2026-09-15T09:01:00.000Z',
    };
    const systemMessageAfterSkip = toBuyerChatSystemMessage('session-1', {
      id: 'system-msg-3',
      speaker: 'system',
      text: extracted.conversation.nextQuestion,
      date: '2026-09-15T09:01:00.000Z',
    });
    const service = { continueCriteriaSessionFromChatTurn: jest.fn().mockReturnValue(systemMessageAfterSkip) };
    const controller = new BuyerController(service as never);

    const result = controller.continueCriteriaSession(turnRequest);

    expect(result).toBe(systemMessageAfterSkip);
    expect(service.continueCriteriaSessionFromChatTurn).toHaveBeenCalledWith(turnRequest);
  });
});
