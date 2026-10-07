import { AiService } from './ai.service';
import { FixtureProviderService } from './fixture-provider.service';
import { RealProviderService } from './real-provider.service';
import { ProfilesService } from '../profiles/profiles.service';

describe('AiService', () => {
  function createService() {
    const fixtureProvider = {
      generate: jest.fn(async (request: { role?: 'buyer' | 'seller' }) => ({
        provider: 'fixture' as const,
        mode: 'fixture' as const,
        isRelevant: true,
        error: null,
        content: 'Response',
        summary: 'Summary',
        recommendation: 'Recommendation',
        nextAction: 'Next action',
        confidence: 'medium' as const,
        structuredAnswer: request.role === 'seller'
          ? {
            role: 'seller' as const, language: 'he' as const, intent: 'unknown', category: 'other', item: {},
            missingFacts: [], confirmedFacts: [], uncertainFacts: [],
            sellerConfirmation: { required: false, status: 'pending' as const },
            hasContactDetails: false, hasImages: false,
          }
          : { role: 'buyer' as const, language: 'he' as const, intent: 'unknown', hasContactDetails: false, hasImages: false },
      })),
    };
    const service = new AiService(
      fixtureProvider as unknown as FixtureProviderService,
      {} as RealProviderService,
      { get: jest.fn((_key: string, fallback?: string) => fallback) } as never,
      { captureContactIfPresent: jest.fn() } as unknown as ProfilesService,
    );
    return service;
  }
//test - buyer intent routing for recognized follow-up requests
  it('adds a buyer intent route for recognized follow-up requests', async () => {
    const response = await createService().generate({ prompt: 'תציג לי את היסטוריית המכירות שלו' });

    expect(response.intentRoute).toEqual({
      intent: 'same_item_sale_history',
      functionName: 'getComparableSaleHistory',
      readyForFunction: false,
      missingFields: ['selectedLot', 'lots'],
      arguments: {},
    });
  });
//test - no buyer routing for seller role
  it('does not add buyer routing to seller responses', async () => {
    const response = await createService().generate({
      prompt: 'תציג לי את היסטוריית המכירות שלו',
      role: 'seller',
    });

    expect(response.intentRoute).toBeUndefined();
  });
});