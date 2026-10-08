import { P4AiGenerateClient } from '../ai/p4-ai-generate.client';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerP4BridgeService } from './buyer-p4-bridge.service';

describe('BuyerP4BridgeService house ranking', () => {
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
