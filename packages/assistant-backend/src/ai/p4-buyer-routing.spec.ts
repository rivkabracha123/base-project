import type { AiExtractResponse } from '../buyer/buyer-criteria';
import type { P4AiGenerateResponse } from './p4-ai.types';
import {
  SHILAT_INTENT_SEARCH_AUCTION_LOTS,
  SHILAT_MISSING_SEARCH_FUNCTION,
  p4AllowsBuyerLotSearch,
  resolveBuyerActionFromP4,
} from './p4-buyer-routing';

function shilatFixtureResponse(): P4AiGenerateResponse {
  const extract: AiExtractResponse = {
    provider: 'fixture',
    mode: 'fixture',
    isRelevant: true,
    error: null,
    confidence: 'low',
    content: 'תוצאה קבועה (fixture): פריט דוגמתי',
    summary: 'הבקשה שלך היא למצוא ציור.',
    recommendation: 'נשתמש בפרטי הפריט',
    nextAction: 'יש שנה או תקופה מועדפת?',
    structuredAnswer: {
      role: 'buyer',
      language: 'he',
      intent: 'מצא ציור',
      category: 'ציורים',
      price: { max: 5000, currency: 'ILS' },
      hasContactDetails: false,
      hasImages: false,
      completionState: {
        fields: { category: 'provided', budget: 'provided', period: 'missing' },
        blockingFields: [],
        readyForFunctions: true,
      },
    } as AiExtractResponse['structuredAnswer'],
  };

  return {
    extract,
    readyForFunction: false,
    intentRoute: {
      intent: SHILAT_INTENT_SEARCH_AUCTION_LOTS,
      functionName: null,
      readyForFunction: false,
      missingFields: [SHILAT_MISSING_SEARCH_FUNCTION],
      arguments: { language: 'he' },
    },
    functionParameters: null,
  };
}

describe('p4BuyerRouting (Shilat contract)', () => {
  it('allows B2 search when intent is search_auction_lots and only searchAuctionLotsFunction is missing', () => {
    const ai = shilatFixtureResponse();
    expect(p4AllowsBuyerLotSearch(ai)).toBe(true);
    expect(resolveBuyerActionFromP4(ai).kind).toBe('searchLots');
  });
});
