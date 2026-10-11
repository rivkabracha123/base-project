import { ConfigService } from '@nestjs/config';
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
