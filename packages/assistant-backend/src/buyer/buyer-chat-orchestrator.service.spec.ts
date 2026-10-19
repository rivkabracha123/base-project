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
import { appendBuyerConversationContext } from './buyer-criteria-session.store';
import { buildFixtureAiExtract } from '../ai/fixture-ai-extract';

describe('BuyerChatOrchestratorService', () => {
  it('starts the search with the known item when the provider is unavailable', async () => {
    const criteria = new BuyerCriteriaService();
    const p4 = { generateBuyerExtract: jest.fn().mockRejectedValue(new ServiceUnavailableException()) };
    const bridge = new BuyerP4BridgeService(p4 as never, criteria);
    const executor = { execute: jest.fn().mockResolvedValue(false) };
    const orchestrator = new BuyerChatOrchestratorService(bridge, criteria, executor as never);
    const opened = await orchestrator.handleMessage({ message: 'I want a blue ring', language: 'en' });
    expect(criteria.getSessionResponse(opened.sessionId).conversation.missing).toEqual([]);
    expect(executor.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ intentRoute: expect.objectContaining({ functionName: 'searchLots', readyForFunction: true }) }),
      expect.objectContaining({ criteriaComplete: true }), expect.any(Array),
    );
    expect(criteria.getCriteriaForSession(opened.sessionId).categories).toEqual(['rings']);
    expect(criteria.getCriteriaForSession(opened.sessionId).creators).toEqual([]);
    expect(criteria.getCriteriaForSession(opened.sessionId).periods).toEqual([]);
    expect(criteria.getCriteriaForSession(opened.sessionId).geography).toEqual([]);
    expect(criteria.getSessionResponse(opened.sessionId).conversation.skipped).toEqual([]);
  });
  it('does not route a budget refinement through AI after results can be searched', async () => {
    const criteria = new BuyerCriteriaService();
    const chat = criteria.startCriteriaSessionFromAiResponse({ provider: 'real', mode: 'real', isRelevant: true,
      content: 'ring', summary: '', recommendation: '', nextAction: '', confidence: 'medium',
      structuredAnswer: { role: 'buyer', language: 'he', intent: 'search', category: 'rings', hasContactDetails: false, hasImages: false } });
    const bridge = { routeBuyerMessage: jest.fn(), evaluateSearchReadiness: jest.fn().mockResolvedValue({ functionName: 'searchLots', readyForFunction: true }) };
    const executor = { execute: jest.fn() };
    const orchestrator = new BuyerChatOrchestratorService(bridge as never, criteria, executor as never);
    const result = await orchestrator.handleMessage({ sessionId: chat.sessionId, message: '250 שקלים', language: 'he' });
    expect(bridge.routeBuyerMessage).not.toHaveBeenCalled();
    expect(criteria.getCriteriaForSession(chat.sessionId).price).toEqual({ max: 250, currency: 'ILS' });
    expect(result.turn.buyer.message).toBe('250 שקלים');
    expect(result.turn.buyer.skipped).toBe(false);
  });
  it('records a period refinement locally without asking AI to re-interpret it', async () => {
    const criteria = new BuyerCriteriaService();
    const chat = criteria.startCriteriaSessionFromAiResponse({ provider: 'real', mode: 'real', isRelevant: true,
      content: 'painting', summary: '', recommendation: '', nextAction: '', confidence: 'medium',
      structuredAnswer: { role: 'buyer', language: 'en', intent: 'search', category: 'painting', hasContactDetails: false, hasImages: false } });
    const bridge = {
      routeBuyerMessage: jest.fn(),
      evaluateSearchReadiness: jest.fn().mockResolvedValue({ functionName: 'searchLots', readyForFunction: true }),
    };
    const executor = { execute: jest.fn() };
    const orchestrator = new BuyerChatOrchestratorService(bridge as never, criteria, executor as never);

    await orchestrator.handleMessage({ sessionId: chat.sessionId, message: 'from 1920', language: 'en' });

    expect(bridge.routeBuyerMessage).not.toHaveBeenCalled();
    expect(criteria.getCriteriaForSession(chat.sessionId).periods).toEqual(['1920']);
  });
  it('records a budget answer locally even if the model would reject the short reply', async () => {
    const criteria = new BuyerCriteriaService();
    const chat = criteria.startCriteriaSessionFromAiResponse({ provider: 'real', mode: 'real', isRelevant: true,
      content: 'manuscript', summary: '', recommendation: '', nextAction: '', confidence: 'medium',
      structuredAnswer: { role: 'buyer', language: 'he', intent: 'search', category: 'rare_books', keywords: ['manuscript'], hasContactDetails: false, hasImages: false } });
    const bridge = {
      routeBuyerMessage: jest.fn(),
      evaluateSearchReadiness: jest.fn().mockResolvedValue({ functionName: 'searchLots', readyForFunction: true }),
    };
    const executor = { execute: jest.fn() };
    const orchestrator = new BuyerChatOrchestratorService(bridge as never, criteria, executor as never);

    await orchestrator.handleMessage({ sessionId: chat.sessionId, message: '250 dollars', language: 'he' });

    expect(bridge.routeBuyerMessage).not.toHaveBeenCalled();
    expect(criteria.getCriteriaForSession(chat.sessionId).price).toEqual({ max: 250, currency: 'USD' });
    expect(criteria.getSessionResponse(chat.sessionId).conversation.missing).toEqual([]);
  });

  it('does not turn yes into a new search when answering the assistant follow-up question', async () => {
    const criteria = new BuyerCriteriaService();
    const chat = criteria.startCriteriaSessionFromAiResponse(buildFixtureAiExtract('', 'he'));
    appendBuyerConversationContext(chat.sessionId, { speaker: 'buyer', text: 'איזה יהלום נמכר במחיר הגבוה ביותר?' });
    appendBuyerConversationContext(chat.sessionId, { speaker: 'assistant', text: 'היהלום הכחול נמכר בסכום שיא. תרצי לשמוע פרטים נוספים?' });
    const routedAi = {
      extract: { ...buildFixtureAiExtract('כן', 'he'), summary: 'בשמחה, הנה פרטים נוספים על המכירה.' },
      generalInformation: false,
      readyForFunction: true,
      intentRoute: { functionName: 'searchLots', readyForFunction: true },
      functionParameters: null,
    };
    const bridge = {
      routeBuyerMessage: jest.fn().mockResolvedValue(routedAi),
      evaluateSearchReadiness: jest.fn(),
    };
    const executor = { execute: jest.fn() };
    const orchestrator = new BuyerChatOrchestratorService(bridge as never, criteria, executor as never);

    const result = await orchestrator.handleMessage({ sessionId: chat.sessionId, message: 'כן', language: 'he' });

    const routed = bridge.routeBuyerMessage.mock.calls[0];
    expect(routed?.[0]).toBe('כן');
    expect(routed?.[2]).toEqual(expect.objectContaining({ sessionId: chat.sessionId }));
    expect(routed?.[3]).toContainEqual({
      speaker: 'assistant',
      text: 'היהלום הכחול נמכר בסכום שיא. תרצי לשמוע פרטים נוספים?',
    });
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).toMatchObject({
      speaker: 'system',
      text: expect.stringContaining('בשמחה, הנה פרטים נוספים על המכירה.'),
    });
    expect(executor.execute).not.toHaveBeenCalled();
    expect(bridge.evaluateSearchReadiness).not.toHaveBeenCalled();
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

  it('streams the search-step update as soon as the search starts', async () => {
    const { orchestrator } = createOrchestrator();
    const streamed: Array<{ update: { speaker: string; text?: string }; index: number }> = [];
    const sessions: string[] = [];

    const result = await orchestrator.handleMessage(
      { message: 'I want a blue ring', language: 'en' },
      {
        onSessionId: (sessionId) => sessions.push(sessionId),
        onUpdate: (update, index) => streamed.push({ update, index }),
      },
    );

    expect(sessions).toEqual([result.sessionId]);
    expect(streamed).toEqual(expect.arrayContaining([
      expect.objectContaining({
        update: expect.objectContaining({ speaker: 'system', text: expect.stringContaining('Searching for lots') }),
      }),
    ]));
  });

  it('finds manuscript results after Hebrew budget and optional skips without real AI', async () => {
    const { orchestrator, criteria } = createOrchestrator();

    const opened = await orchestrator.handleMessage({ message: 'אני רוצה כתב יד עתיק', language: 'he' });
    await orchestrator.handleMessage({ sessionId: opened.sessionId, message: '250 דולר', language: 'he' });
    await orchestrator.handleMessage({ sessionId: opened.sessionId, message: 'לא', language: 'he' });
    await orchestrator.handleMessage({ sessionId: opened.sessionId, message: 'לא', language: 'he' });
    const result = await orchestrator.handleMessage({ sessionId: opened.sessionId, message: 'לא', language: 'he' });

    expect(criteria.getCriteriaForSession(opened.sessionId)).toMatchObject({
      categories: ['rare_books'],
      price: { max: 250, currency: 'USD' },
    });
    expect(result.updates.some((update) => update.speaker === 'result-group')).toBe(true);
    expect(result.updates.some((update) => update.speaker === 'no-results')).toBe(false);
  });

  it('routes valuation requests in buyer chat to the seller flow without spending an AI call', async () => {
    const criteria = new BuyerCriteriaService();
    const bridge = { openConversation: jest.fn(), routeBuyerMessage: jest.fn(), evaluateSearchReadiness: jest.fn() };
    const executor = { execute: jest.fn() };
    const orchestrator = new BuyerChatOrchestratorService(bridge as never, criteria, executor as never);

    const result = await orchestrator.handleMessage({ message: 'אני רוצה הערכת שווי', language: 'he' });

    expect(result.updates).toEqual([{ speaker: 'system', text: expect.stringContaining('תהליך המוכר') }]);
    expect(bridge.openConversation).not.toHaveBeenCalled();
    expect(bridge.routeBuyerMessage).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
    expect(criteria.getCriteriaForSession(result.sessionId).categories).toEqual([]);
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
