import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { P4AiGenerateClient } from '../ai/p4-ai-generate.client';
import { BuyerChatOrchestratorService } from './buyer-chat-orchestrator.service';
import type { BuyerLotsResolverService } from './buyer-lots-resolver.service';
import type { LotsService } from '../lots/lots.service';
import { BuyerComparableSaleHistoryService } from './buyer-comparable-sale-history.service';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerP4BridgeService } from './buyer-p4-bridge.service';
import { BuyerP4FunctionExecutor } from './buyer-p4-function.executor';
import { BuyerSearchExecutionService } from './buyer-search-execution.service';
import { DefaultBuyerResultsPresentationService } from './default-buyer-results-presentation.service';
import { FixtureLotsSearchClient } from './fixture-lots-search.client';
import { findBuyerFixtureLot, resolveBuyerFixtureLots } from './fixture-lots.pool';

describe('BuyerChatOrchestratorService', () => {
  it('continues through a provider outage and searches only after all questions are answered or explicitly skipped', async () => {
    const criteria = new BuyerCriteriaService();
    const p4 = { generateBuyerExtract: jest.fn().mockRejectedValue(new ServiceUnavailableException()) };
    const bridge = new BuyerP4BridgeService(p4 as never, criteria);
    const executor = { execute: jest.fn().mockResolvedValue(false) };
    const orchestrator = new BuyerChatOrchestratorService(bridge, criteria, executor as never);
    const opened = await orchestrator.handleMessage({ message: 'I want a blue ring', language: 'en' });
    expect(opened.updates.length).toBeGreaterThan(0);
    const answered = await orchestrator.handleMessage({ sessionId: opened.sessionId, message: 'no' });
    expect(answered.updates).toContainEqual({ speaker: 'system', text: 'Is there a specific artist or maker?' });
    expect(criteria.getSessionResponse(opened.sessionId).conversation.skipped).toEqual(['budget']);
    expect(executor.execute.mock.calls.some(call => call[1]?.criteriaComplete === true)).toBe(false);
    for (let index = 0; index < 3; index++) {
      await orchestrator.handleMessage({ sessionId: opened.sessionId, message: 'no' });
    }
    expect(executor.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ intentRoute: expect.objectContaining({ functionName: 'searchLots', readyForFunction: true }) }),
      expect.objectContaining({ criteriaComplete: true }), expect.any(Array),
    );
    expect(criteria.getCriteriaForSession(opened.sessionId).categories).toEqual(['rings']);
    expect(criteria.getCriteriaForSession(opened.sessionId).creators).toEqual([]);
    expect(criteria.getCriteriaForSession(opened.sessionId).periods).toEqual([]);
    expect(criteria.getCriteriaForSession(opened.sessionId).geography).toEqual([]);
    expect(criteria.getSessionResponse(opened.sessionId).conversation.skipped).toEqual(['budget', 'creator', 'period', 'location']);
  });
  it('treats no as a budget skip without classifying it as off-topic', async () => {
    const criteria = new BuyerCriteriaService();
    const chat = criteria.startCriteriaSessionFromAiResponse({ provider: 'real', mode: 'real', isRelevant: true,
      content: 'ring', summary: '', recommendation: '', nextAction: '', confidence: 'medium',
      structuredAnswer: { role: 'buyer', language: 'he', intent: 'search', category: 'rings', hasContactDetails: false, hasImages: false } });
    const bridge = { routeBuyerMessage: jest.fn(), evaluateSearchReadiness: jest.fn().mockResolvedValue({ functionName: 'searchLots', readyForFunction: true }) };
    const executor = { execute: jest.fn() };
    const orchestrator = new BuyerChatOrchestratorService(bridge as never, criteria, executor as never);
    const result = await orchestrator.handleMessage({ sessionId: chat.sessionId, message: 'לא', language: 'he' });
    expect(bridge.routeBuyerMessage).not.toHaveBeenCalled();
    expect(criteria.getSessionResponse(chat.sessionId).conversation.skipped).toContain('budget');
    expect(result.turn.buyer.message).toBe('לא');
    expect(result.turn.buyer.skipped).toBe(true);
  });
  function createOrchestrator() {
    const config = {
      get: (key: string) => (key === 'AI_PROVIDER_MODE' ? 'fixture' : undefined),
    } as ConfigService;
    const p4 = new P4AiGenerateClient(config);
    const criteria = new BuyerCriteriaService();
    const bridge = new BuyerP4BridgeService(p4, criteria);
    const lotsResolver = {
      findLot: jest.fn(async (id: string) => findBuyerFixtureLot(id) ?? null),
      resolveLotPool: jest.fn(async (refs?: { id: string }[]) => resolveBuyerFixtureLots(refs)),
    } as unknown as BuyerLotsResolverService;
    const lotsService = {
      findOne: jest.fn(async (id: string) => findBuyerFixtureLot(id)),
      findSaleHistoryByItemKey: jest.fn(async () => resolveBuyerFixtureLots().filter((lot) => lot.status === 'sold')),
    } as unknown as LotsService;
    const saleHistory = new BuyerComparableSaleHistoryService(lotsService);
    const executor = new BuyerP4FunctionExecutor(
      saleHistory,
      new DefaultBuyerResultsPresentationService(
        new BuyerSearchExecutionService(new FixtureLotsSearchClient()),
      ),
      criteria,
      lotsResolver,
    );
    return { orchestrator: new BuyerChatOrchestratorService(bridge, criteria, executor), criteria };
  }

  it('returns sessionId and a system update on first message (P4 fixture + criteria)', async () => {
    const { orchestrator } = createOrchestrator();

    const result = await orchestrator.handleMessage({
      message: 'The buyer wants a blue painting from the 19th century with a budget around $10k.',
      language: 'en',
    });

    expect(result.sessionId).toBeTruthy();
    expect(result.updates.length).toBeGreaterThanOrEqual(1);
    expect(result.updates[0]?.speaker).toBe('system');
  });

  it('preserves criteria and skips functions for an unrelated follow-up', async () => {
    const criteria = new BuyerCriteriaService();
    const chat = criteria.startCriteriaSessionFromAiResponse({
      provider: 'real', mode: 'real', isRelevant: true, content: 'painting',
      summary: 'painting', recommendation: 'search', nextAction: 'budget?', confidence: 'medium',
      structuredAnswer: { role: 'buyer', language: 'he', intent: 'search', category: 'painting', hasContactDetails: false, hasImages: false },
    });
    const before = JSON.stringify(criteria.getSessionResponse(chat.sessionId));
    const irrelevant = { extract: { isRelevant: false, content: 'unrelated', summary: 'אני עוזרת בחיפוש פריטים למכירה פומבית.', nextAction: 'אפשר לחזור לחיפוש הפריט.' }, readyForFunction: false };
    const bridge = { routeBuyerMessage: jest.fn().mockResolvedValue(irrelevant) };
    const executor = { execute: jest.fn() };
    const orchestrator = new BuyerChatOrchestratorService(bridge as unknown as BuyerP4BridgeService, criteria, executor as unknown as BuyerP4FunctionExecutor);
    const result = await orchestrator.handleMessage({ sessionId: chat.sessionId, message: 'אני רוצה מתכון לעוגת קוקוס', language: 'he' });
    expect(result.updates).toEqual([{ speaker: 'system', text: `${irrelevant.extract.summary}\n${irrelevant.extract.nextAction}` }]);
    expect(JSON.stringify(criteria.getSessionResponse(chat.sessionId))).toBe(before);
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('shows the off-topic answer on the first turn', async () => {
    const bridge = { openConversation: jest.fn().mockResolvedValue({ chat: { sessionId: 'session-1', text: 'generic' }, ai: { extract: { isRelevant: false, content: 'unrelated', nextAction: 'Return to auction items.' } } }) };
    const executor = { execute: jest.fn() };
    const orchestrator = new BuyerChatOrchestratorService(bridge as unknown as BuyerP4BridgeService, new BuyerCriteriaService(), executor as unknown as BuyerP4FunctionExecutor);
    const result = await orchestrator.handleMessage({ message: 'cake recipe', language: 'en' });
    expect(result.updates[0]).toEqual({ speaker: 'system', text: 'unrelated\nReturn to auction items.' });
    expect(executor.execute).not.toHaveBeenCalled();
  });
});
