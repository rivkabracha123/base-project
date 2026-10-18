import { P4AiGenerateClient } from '../ai/p4-ai-generate.client';
import { buildFixtureAiExtract } from '../ai/fixture-ai-extract';
import { ServiceUnavailableException } from '@nestjs/common';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerP4BridgeService } from './buyer-p4-bridge.service';
import { getBuyerCriteriaSession, resetBuyerCriteriaSessions } from './buyer-criteria-session.store';

describe('BuyerP4BridgeService house ranking', () => {
  it.each([undefined, { id: 'selected-sale' }])('overrides an AI search route for an explicit history request', async selectedLot => {
    const p4 = { generateBuyerExtract: jest.fn().mockResolvedValue({
      extract: buildFixtureAiExtract('ring', 'he'), readyForFunction: true,
      intentRoute: { functionName: 'searchLots', readyForFunction: true }, functionParameters: null,
    }) };
    const bridge = new BuyerP4BridgeService(p4 as never, new BuyerCriteriaService());
    const ai = await bridge.routeBuyerMessage('אני רוצה היסטוריה', 'he', { selectedLot });
    expect(ai.intentRoute).toMatchObject({ functionName: 'getComparableSaleHistory', readyForFunction: !!selectedLot });
  });
  afterEach(() => resetBuyerCriteriaSessions());
  it('opens and completes guided criteria when the AI is unavailable without clearing saved facts', async () => {
    const criteria = new BuyerCriteriaService();
    const p4 = { generateBuyerExtract: jest.fn().mockRejectedValue(new ServiceUnavailableException()) };
    const bridge = new BuyerP4BridgeService(p4 as never, criteria);
    const opened = await bridge.openConversation({ message: 'I want a blue ring', language: 'en' });
    const id = opened.chat.sessionId;
    expect(criteria.getCriteriaForSession(id).categories).toEqual(['rings']);
    expect(criteria.getCriteriaForSession(id).keywords).toContain('blue');
    expect(await bridge.evaluateSearchReadiness(id)).toMatchObject({ readyForFunction: false });
    const followup = await bridge.routeBuyerMessage('similar items', 'en', { sessionId: id });
    expect(followup.intentRoute).toMatchObject({ intent: 'search_similar_lots', readyForFunction: true });
    for (let index = 0; index < 4; index++) {
      criteria.continueCriteriaSessionFromChat({ id: `skip-${index}`, sessionId: id, speaker: 'buyer', skipped: true });
    }
    expect(await bridge.evaluateSearchReadiness(id)).toMatchObject({ functionName: 'searchLots', readyForFunction: true });
    expect(criteria.getCriteriaForSession(id).categories).toEqual(['rings']);
  });

  it('does not hide programming errors as provider failures', async () => {
    const p4 = { generateBuyerExtract: jest.fn().mockRejectedValue(new Error('unexpected bug')) };
    const bridge = new BuyerP4BridgeService(p4 as never, new BuyerCriteriaService());
    await expect(bridge.openConversation({ message: 'ring', language: 'en' })).rejects.toThrow('unexpected bug');
  });
  it('stores an explicitly requested ring under rings rather than broad jewelry', async () => {
    const criteria = new BuyerCriteriaService();
    const p4 = { generateBuyerExtract: jest.fn().mockResolvedValue({
      extract: { provider: 'real', mode: 'real', isRelevant: true, content: 'ring', summary: '', recommendation: '', nextAction: '', confidence: 'medium',
        structuredAnswer: { role: 'buyer', language: 'he', intent: 'search', category: 'jewelry', hasContactDetails: false, hasImages: false } },
      readyForFunction: false, intentRoute: { functionName: null, readyForFunction: false }, functionParameters: null,
    }) };
    const bridge = new BuyerP4BridgeService(p4 as never, criteria);
    const result = await bridge.openConversation({ message: 'אני רוצה לקנות טבעת כחולה', language: 'he' });
    expect(criteria.getCriteriaForSession(result.chat.sessionId).categories).toEqual(['rings']);
  });

  it.each([
    { categories: ['painting', 'rings'], extractedCategory: 'painting', expected: 'rings' },
    { categories: ['painting', '', ' rings ', '   '], extractedCategory: undefined, expected: 'rings' },
    { categories: ['', '   '], extractedCategory: 'rare_books', expected: 'rare_books' },
    { categories: ['', '   '], extractedCategory: undefined, expected: undefined },
  ])('uses the last non-empty category with extraction fallback: $categories', async ({ categories, extractedCategory, expected }) => {
    const criteria = new BuyerCriteriaService();
    const extract = {
      provider: 'real' as const, mode: 'real' as const, isRelevant: true,
      content: 'painting', summary: 'painting', recommendation: 'search', nextAction: 'budget?', confidence: 'medium' as const,
      structuredAnswer: { role: 'buyer' as const, language: 'en' as const, intent: 'search', category: 'painting', hasContactDetails: false, hasImages: false },
    };
    const chat = criteria.startCriteriaSessionFromAiResponse(extract);
    const session = getBuyerCriteriaSession(chat.sessionId)!;
    session.criteria.categories = [...categories];
    const p4 = { generateBuyerExtract: jest.fn().mockResolvedValue({
      extract: { ...extract, structuredAnswer: { ...extract.structuredAnswer, category: extractedCategory } },
      readyForFunction: false, intentRoute: { functionName: null, readyForFunction: false }, functionParameters: null,
    }) };
    const bridge = new BuyerP4BridgeService(p4 as unknown as P4AiGenerateClient, criteria);
    const result = await bridge.routeBuyerMessage('Which auction house specializes in this?', 'en', { sessionId: chat.sessionId });
    expect(result.intentRoute).toMatchObject({ functionName: 'rankSellerHouses', readyForFunction: !!expected,
      missingFields: expected ? [] : ['category'] });
    expect(result.intentRoute?.arguments).toEqual(expected ? { category: expected, language: 'en' } : { language: 'en' });
    expect(result.readyForFunction).toBe(!!expected);
    expect(session.criteria.categories).toEqual(categories);
  });
  it('uses the existing search category for a question about this category', async () => {
    const criteria = new BuyerCriteriaService();
    const extract = {
      provider: 'real' as const, mode: 'real' as const, isRelevant: true,
      content: 'painting', summary: 'painting', recommendation: 'search', nextAction: 'budget?', confidence: 'medium' as const,
      structuredAnswer: { role: 'buyer' as const, language: 'he' as const, intent: 'search', category: 'painting', geography: ['Israel'], hasContactDetails: false, hasImages: false },
    };
    const chat = criteria.startCriteriaSessionFromAiResponse(extract);
    const p4 = { generateBuyerExtract: jest.fn().mockResolvedValue({
      extract: { ...extract, isRelevant: false, structuredAnswer: { ...extract.structuredAnswer, category: undefined, geography: undefined } },
      readyForFunction: false, intentRoute: { functionName: null, readyForFunction: false }, functionParameters: null,
    }) };
    const bridge = new BuyerP4BridgeService(p4 as unknown as P4AiGenerateClient, criteria);
    const result = await bridge.routeBuyerMessage('איזה בית מכירות הכי מתמחה בתחום הזה?', 'he', { sessionId: chat.sessionId });
    expect(result.intentRoute).toEqual({
      intent: 'buyer_house_ranking', functionName: 'rankSellerHouses', readyForFunction: true,
      missingFields: [], arguments: { category: 'painting', geography: 'Israel', language: 'he' },
    });
    expect(result.functionParameters).toEqual(result.intentRoute.arguments);
    expect(result.extract.isRelevant).toBe(true);
  });
});
