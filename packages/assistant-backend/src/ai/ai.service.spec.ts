import { Logger, ServiceUnavailableException } from '@nestjs/common';
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
      missingFields: ['selectedLot.id'],
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
  describe('generateText', () => {
    const realConfig = (values: Record<string, string>) =>
      ({ get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback) }) as never;
    const profiles = { captureContactIfPresent: jest.fn() } as unknown as ProfilesService;

    it('refuses free text in fixture mode so callers use their own template', async () => {
      const service = new AiService({} as FixtureProviderService, {} as RealProviderService, realConfig({}), profiles);
      await expect(service.generateText({ prompt: 'Describe the item' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('turns a provider failure into 503 and logs only the coarse reason', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const realProvider = { generateText: jest.fn().mockRejectedValue(new Error('Real provider request failed: 429 key=secret-key')) };
      const service = new AiService({} as FixtureProviderService, realProvider as unknown as RealProviderService,
        realConfig({ AI_PROVIDER_MODE: 'real', AI_BASE_URL: 'https://example.com/v1', AI_MODEL_NAME: 'm', AI_API_KEY: 'secret-key' }), profiles);

      await expect(service.generateText({ prompt: 'Describe the item', language: 'he' })).rejects.toBeInstanceOf(ServiceUnavailableException);
      const logged = warn.mock.calls.map((call) => String(call[0])).join(' | ');
      expect(logged).toContain('http_429');
      expect(logged).not.toContain('secret-key');
      warn.mockRestore();
    });
  });
});
