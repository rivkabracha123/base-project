import { ServiceUnavailableException } from '@nestjs/common';
import { BuyerChatOrchestratorService } from './buyer-chat-orchestrator.service';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerP4BridgeService } from './buyer-p4-bridge.service';

function ai(intent: string, category: string) {
  return { extract: { provider: 'real', mode: 'real', isRelevant: true, error: null, content: 'Auction answer',
    summary: 'A historical auction example.', recommendation: 'The sale was held at an auction house.', nextAction: 'Ask about its history.', confidence: 'medium',
    structuredAnswer: { role: 'buyer', language: 'en', intent, category, hasContactDetails: false, hasImages: false } },
    readyForFunction: false, intentRoute: { functionName: null, readyForFunction: false }, functionParameters: null };
}

describe('buyer general auction information', () => {
  it('routes previous manuscript sales using saved criteria despite a general-information model answer', async () => {
    const criteria = new BuyerCriteriaService();
    const provider = { generateBuyerExtract: jest.fn().mockResolvedValueOnce(ai('search', 'manuscripts')).mockResolvedValue(ai('general_information', 'unknown')) };
    const bridge = new BuyerP4BridgeService(provider as never, criteria);
    const opened = await bridge.openConversation({ message: 'אני מחפש כתב יד עתיק בתקציב של 250 דולר', language: 'he' });
    expect(criteria.getCriteriaForSession(opened.chat.sessionId).price).toEqual({ max: 250, currency: 'USD' });
    const reply = await bridge.routeBuyerMessage('אני רוצה מכירות קודמות', 'he', { sessionId: opened.chat.sessionId });
    expect(reply.generalInformation).toBe(false);
    expect(reply.intentRoute).toMatchObject({ intent: 'search_similar_lots', readyForFunction: true, arguments: { category: 'rare_books', status: 'sold' } });
  });
  it('retains an explicitly requested manuscript when the AI misses its category and budget is skipped', async () => {
    const criteria = new BuyerCriteriaService();
    const provider = { generateBuyerExtract: jest.fn().mockResolvedValue(ai('search', 'unknown')) };
    const executor = { execute: jest.fn().mockResolvedValue(false) };
    const chat = new BuyerChatOrchestratorService(new BuyerP4BridgeService(provider as never, criteria), criteria, executor as never);
    const first = await chat.handleMessage({ message: 'אני מחפש כתב יד עתיק', language: 'he' });
    expect(criteria.getCriteriaForSession(first.sessionId).categories).toContain('rare_books');
    await chat.handleMessage({ message: 'לא', sessionId: first.sessionId });
    expect(criteria.getCriteriaForSession(first.sessionId).categories).toContain('rare_books');
  });
  it('answers an initial knowledge question without asking for budget or searching', async () => {
    const criteria = new BuyerCriteriaService();
    const provider = { generateBuyerExtract: jest.fn().mockResolvedValue(ai('general_information', 'paintings')) };
    const bridge = new BuyerP4BridgeService(provider as never, criteria);
    const executor = { execute: jest.fn() };
    const chat = new BuyerChatOrchestratorService(bridge, criteria, executor as never);
    const response = await chat.handleMessage({ message: 'איזה מפורסם מכר מוצר במכירה פומבית?', language: 'he' });
    expect(response.updates).toEqual([{ speaker: 'system', text: 'A historical auction example.\nThe sale was held at an auction house.\nAsk about its history.' }]);
    expect(criteria.getCriteriaForSession(response.sessionId).categories).toEqual([]);
    expect(executor.execute).not.toHaveBeenCalled();
  });
  it('preserves existing buyer criteria across a general question', async () => {
    const criteria = new BuyerCriteriaService();
    const provider = { generateBuyerExtract: jest.fn().mockResolvedValueOnce(ai('search', 'rings')).mockResolvedValue(ai('general_information', 'paintings')) };
    const executor = { execute: jest.fn().mockResolvedValue(false) };
    const chat = new BuyerChatOrchestratorService(new BuyerP4BridgeService(provider as never, criteria), criteria, executor as never);
    const first = await chat.handleMessage({ message: 'I want a ring', language: 'en' });
    const before = JSON.parse(JSON.stringify(criteria.getSessionResponse(first.sessionId)));
    executor.execute.mockClear();
    const reply = await chat.handleMessage({ message: 'What is an auction record?', sessionId: first.sessionId });
    expect(reply.updates[0]).toMatchObject({ speaker: 'system', text: expect.stringContaining('historical auction') });
    expect(criteria.getSessionResponse(first.sessionId)).toEqual(before);
    expect(executor.execute).not.toHaveBeenCalled();
  });
  it('does not ask buying questions when the AI is unavailable for a knowledge question', async () => {
    const criteria = new BuyerCriteriaService();
    const provider = { generateBuyerExtract: jest.fn().mockRejectedValue(new ServiceUnavailableException()) };
    const executor = { execute: jest.fn() };
    const chat = new BuyerChatOrchestratorService(new BuyerP4BridgeService(provider as never, criteria), criteria, executor as never);
    const response = await chat.handleMessage({ message: 'איזה מפורסם מכר מוצר במכירה פומבית?', language: 'he' });
    expect(response.updates).toEqual([{ speaker: 'system', text: expect.stringContaining('אינו זמין') }]);
    expect(executor.execute).not.toHaveBeenCalled();
  });
});
