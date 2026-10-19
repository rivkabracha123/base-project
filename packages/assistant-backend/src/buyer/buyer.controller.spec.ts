import { BuyerController } from './buyer.controller';
import { parseCriteriaFromAiResponse } from './buyer-criteria';
import { buildChatSystemMessage } from './buyer-chat-messages';
import { sampleAiExtractResponses } from './buyer-criteria.fixtures';

describe('BuyerController', () => {
  const extracted = parseCriteriaFromAiResponse(sampleAiExtractResponses.paintingEn());
  const systemMessageAfterExtract = buildChatSystemMessage('session-1', {
    id: 'system-msg-1',
    speaker: 'system',
    text: extracted.conversation.nextQuestion,
  });
  const systemMessageAfterTurn = buildChatSystemMessage('session-1', {
    id: 'system-msg-2',
    speaker: 'system',
    text: 'Is there a place or origin that matters?',
  });

  it('startCriteriaSession delegates to the service', () => {
    const service = { startCriteriaSessionFromAiResponse: jest.fn().mockReturnValue(systemMessageAfterExtract) };
    const search = { searchForSession: jest.fn() };
    const bridge = { openConversation: jest.fn() };
    const p4 = { generateBuyerExtract: jest.fn() };
    const orchestrator = { handleMessage: jest.fn() };
    const saleHistory = { getHistory: jest.fn() };
    const controller = new BuyerController(
      service as never,
      search as never,
      bridge as never,
      p4 as never,
      orchestrator as never,
      saleHistory as never,
    );

    const result = controller.startCriteriaSession(sampleAiExtractResponses.paintingEn());

    expect(result).toBe(systemMessageAfterExtract);
    expect(service.startCriteriaSessionFromAiResponse).toHaveBeenCalledWith(sampleAiExtractResponses.paintingEn());
  });

  it('continueCriteriaSession delegates buyer messages to the service', () => {
    const turnRequest = {
      id: 'buyer-msg-1',
      sessionId: 'session-1',
      speaker: 'buyer' as const,
      skipped: false as const,
      text: 'Monet',
    };
    const service = { continueCriteriaSessionFromChat: jest.fn().mockReturnValue(systemMessageAfterTurn) };
    const search = { searchForSession: jest.fn() };
    const bridge = { openConversation: jest.fn() };
    const p4 = { generateBuyerExtract: jest.fn() };
    const orchestrator = { handleMessage: jest.fn() };
    const saleHistory = { getHistory: jest.fn() };
    const controller = new BuyerController(
      service as never,
      search as never,
      bridge as never,
      p4 as never,
      orchestrator as never,
      saleHistory as never,
    );

    const result = controller.continueCriteriaSession(turnRequest);

    expect(result).toBe(systemMessageAfterTurn);
    expect(service.continueCriteriaSessionFromChat).toHaveBeenCalledWith(turnRequest);
  });

  it('continueCriteriaSession delegates buyer skip to the service', () => {
    const turnRequest = {
      id: 'buyer-msg-skip',
      sessionId: 'session-1',
      speaker: 'buyer' as const,
      skipped: true as const,
    };
    const systemMessageAfterSkip = buildChatSystemMessage('session-1', {
      id: 'system-msg-3',
      speaker: 'system',
      text: extracted.conversation.nextQuestion,
    });
    const service = { continueCriteriaSessionFromChat: jest.fn().mockReturnValue(systemMessageAfterSkip) };
    const search = { searchForSession: jest.fn() };
    const bridge = { openConversation: jest.fn() };
    const p4 = { generateBuyerExtract: jest.fn() };
    const orchestrator = { handleMessage: jest.fn() };
    const saleHistory = { getHistory: jest.fn() };
    const controller = new BuyerController(
      service as never,
      search as never,
      bridge as never,
      p4 as never,
      orchestrator as never,
      saleHistory as never,
    );

    const result = controller.continueCriteriaSession(turnRequest);

    expect(result).toBe(systemMessageAfterSkip);
    expect(service.continueCriteriaSessionFromChat).toHaveBeenCalledWith(turnRequest);
  });

  it('writes search updates to the stream before the conversation is complete', async () => {
    let finish!: () => void;
    const fullResponse = { sessionId: 'session-1', updates: [], turn: { at: '', buyer: { message: '', skipped: false }, updates: [] } };
    const orchestrator = {
      handleMessage: jest.fn(async (_request, callbacks) => {
        callbacks.onSessionId('session-1');
        callbacks.onUpdate({ speaker: 'system', text: 'מחפשים פריטים לפי קטגוריה: ספרים נדירים…' }, 0);
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        return fullResponse;
      }),
    };
    const writes: string[] = [];
    const response = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      on: jest.fn(),
      writableEnded: false,
      write: jest.fn((chunk: string) => writes.push(chunk)),
      end: jest.fn(),
    };
    const controller = new BuyerController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      orchestrator as never,
      {} as never,
    );

    const pending = controller.handleConversationMessageStream({ message: 'כתב יד עתיק' }, response as never);
    await Promise.resolve();

    expect(writes.map((frame) => JSON.parse(frame.replace(/^data:\s*|\s*$/g, '')))).toEqual([
      { type: 'started' },
      { type: 'session', sessionId: 'session-1' },
      { type: 'update', index: 0, update: { speaker: 'system', text: 'מחפשים פריטים לפי קטגוריה: ספרים נדירים…' } },
    ]);

    finish();
    await pending;
    expect(writes.some((frame) => frame.includes('"type":"complete"'))).toBe(true);
    expect(response.end).toHaveBeenCalledTimes(1);
  });
});
