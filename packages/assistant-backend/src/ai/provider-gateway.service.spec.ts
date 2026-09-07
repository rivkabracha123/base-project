import { FixtureProviderService } from './fixture-provider.service';
import { ProviderGatewayService } from './provider-gateway.service';
import { RealProviderService } from './real-provider.service';
import { isSellerHandoffContract } from './seller-handoff';

// test 1 - seller fixture response
describe('ProviderGatewayService', () => {
  it('connects a seller fixture response to the validated seller consumer contract', async () => {
    const fixtureProvider = new FixtureProviderService();
    const realProvider = { generate: jest.fn() } as unknown as RealProviderService;
    const service = new ProviderGatewayService({ fixtureProvider, realProvider });

    const result = await service.generate(
      { prompt: 'I have a blue painting to sell', role: 'seller', language: 'en' },
      [{ kind: 'fixture', enabled: true }],
    );

    expect(result.provider).toBe('fixture');
    expect(isSellerHandoffContract(result.structuredAnswer)).toBe(true);
    expect(result.structuredAnswer).toEqual(
      expect.objectContaining({ role: 'seller', category: 'paintings' }),
    );
  });

  // test 2 - seller real response

  it('accepts a real seller response that matches the seller contract', async () => {
    const fixtureProvider = { generate: jest.fn() } as unknown as FixtureProviderService;
    const realProvider = {
      generate: jest.fn().mockResolvedValue({
        provider: 'real',
        mode: 'real',
        content: 'real seller reply',
        summary: 'פריט מוכן לעיבוד',
        recommendation: 'בקשו פרטים נוספים על מקור ונסיבות',
        nextAction: 'המשיכו בבדיקת מצב הפריט',
        confidence: 'medium',
        structuredAnswer: {
          role: 'seller',
          language: 'he',
          intent: 'Prepare this item for auction review.',
          category: 'paintings',
          item: {
            title: 'ציור נוף',
            dimensions: '60x80 ס"מ',
            condition: 'מצב טוב',
            provenance: 'משפחה',
          },
          missingFacts: ['חתימה', 'מסמכים'],
          hasContactDetails: false,
          hasImages: false,
        },
      }),
    } as unknown as RealProviderService;

    const service = new ProviderGatewayService({ fixtureProvider, realProvider });

    const result = await service.generate(
      { prompt: 'יש לי ציור שמוכר', role: 'seller', language: 'he' },
      [
        { kind: 'fixture', enabled: true },
        {
          kind: 'real',
          enabled: true,
          baseUrl: 'https://example.com/v1',
          modelName: 'gpt-4o-mini',
          apiKey: 'token',
        },
      ],
    );

    expect(result.provider).toBe('real');
    expect(isSellerHandoffContract(result.structuredAnswer)).toBe(true);
    expect(result.structuredAnswer).toEqual(
      expect.objectContaining({ role: 'seller', category: 'paintings' }),
    );
  });

  // test 3 - no contact details or image data
  it('does not expose contact details, URLs, or image payloads in the provider response', async () => {
    const fixtureProvider = {
      generate: jest.fn().mockResolvedValue({
        provider: 'fixture',
        mode: 'fixture',
        content: 'safe fixture response',
        summary: 'תגובה בטוחה',
        recommendation: 'הצג פריטים רלוונטיים',
        nextAction: 'בקש פרטים נוספים',
        confidence: 'low',
        structuredAnswer: {
          role: 'seller',
          language: 'he',
          intent: 'Prepare this item for auction review.',
          category: 'paintings',
          item: {
            title: 'ציור נוף',
            condition: 'מצב טוב',
          },
          missingFacts: ['חתימה', 'מסמכים'],
          hasContactDetails: false,
          hasImages: false,
        },
      }),
    } as unknown as FixtureProviderService;
    const realProvider = { generate: jest.fn() } as unknown as RealProviderService;
    const service = new ProviderGatewayService({ fixtureProvider, realProvider });

    const result = await service.generate(
      { prompt: 'יש לי ציור שמוכר', role: 'seller', language: 'he' },
      [{ kind: 'fixture', enabled: true }],
    );

    const serialized = JSON.stringify(result);

    expect(serialized).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(serialized).not.toMatch(/\b\d{3}[- ]?\d{3}[- ]?\d{4}\b/);
    expect(serialized).not.toMatch(/https?:\/\//i);
    expect(serialized).not.toMatch(/data:image\//i);
    expect(serialized).not.toMatch(/base64/i);
  });

  // test 4 - use the real provider
  it('uses the real provider when it is enabled and configured', async () => {
    const fixtureProvider = { generate: jest.fn() } as unknown as FixtureProviderService;
    const realProvider = {
      generate: jest.fn().mockResolvedValue({
        provider: 'real',
        mode: 'real',
        content: 'real reply',
        summary: 'התגובה אמיתית',
        recommendation: 'הצג אפשרות רלוונטית',
        nextAction: 'בקש פרטים נוספים',
        confidence: 'medium',
        structuredAnswer: {
          role: 'buyer',
          language: 'he',
          intent: 'Find a blue ring matching the requested period and budget.',
          category: 'rings',
          missingFacts: ['budget', 'size', 'condition'],
          hasContactDetails: false,
          hasImages: false,
        },
      }),
    } as unknown as RealProviderService;

    const service = new ProviderGatewayService({ fixtureProvider, realProvider });

    const result = await service.generate(
      { prompt: 'טבעת כחולה', language: 'he' },
      [
        { kind: 'fixture', enabled: true },
        {
          kind: 'real',
          enabled: true,
          baseUrl: 'https://example.com/v1',
          modelName: 'gpt-4o-mini',
          apiKey: 'token',
        },
      ],
    );

    expect(result.provider).toBe('real');
    expect(result.content).toBe('real reply');
    expect(result.summary).toBe('התגובה אמיתית');
    expect(realProvider.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'טבעת כחולה',
        language: 'he',
        baseUrl: 'https://example.com/v1',
        modelName: 'gpt-4o-mini',
        apiKey: 'token',
      }),
    );
  });

  // test 5 - fallback after provider error

  it('falls back to the fixture provider when the real provider fails', async () => {
    const fixtureProvider = {
      generate: jest.fn().mockResolvedValue({
        provider: 'fixture',
        mode: 'fixture',
        content: 'fixture fallback',
        summary: 'תגובה קבועה',
        recommendation: 'הצג אפשרות חלופית',
        nextAction: 'המשך עם דוגמה קבועה',
        confidence: 'medium',
      }),
    } as unknown as FixtureProviderService;
    const realProvider = {
      generate: jest.fn().mockRejectedValue(new Error('network issue')),
    } as unknown as RealProviderService;

    const service = new ProviderGatewayService({ fixtureProvider, realProvider });

    const result = await service.generate(
      { prompt: 'טבעת כחולה', language: 'he' },
      [{ kind: 'real', enabled: true, baseUrl: 'https://example.com/v1', modelName: 'gpt-4o-mini', apiKey: 'token' }],
    );

    expect(result.provider).toBe('fixture');
    expect(result.content).toBe('fixture fallback');
    expect(fixtureProvider.generate).toHaveBeenCalledWith({ prompt: 'טבעת כחולה', language: 'he' });
  });

  // test 6 - use fixture without real provider

  it('uses the fixture provider when no real provider is enabled', async () => {
    const fixtureProvider = {
      generate: jest.fn().mockResolvedValue({
        provider: 'fixture',
        mode: 'fixture',
        content: 'safe fixture response',
        summary: 'תגובה בטוחה',
        recommendation: 'הצג פריטים רלוונטיים',
        nextAction: 'בקש פרטים נוספים',
        confidence: 'low',
      }),
    } as unknown as FixtureProviderService;
    const realProvider = {
      generate: jest.fn(),
    } as unknown as RealProviderService;

    const service = new ProviderGatewayService({ fixtureProvider, realProvider });

    const result = await service.generate(
      { prompt: 'טבעת כחולה', language: 'he' },
      [{ kind: 'fixture', enabled: true }],
    );

    expect(result.provider).toBe('fixture');
    expect(result.content).toBe('safe fixture response');
    expect(realProvider.generate).not.toHaveBeenCalled();
  });

  // test 7 - fallback when real config is missing

  it('does not enable the real provider when its configuration is incomplete', async () => {
    const fixtureProvider = {
      generate: jest.fn().mockResolvedValue({
        provider: 'fixture',
        mode: 'fixture',
        content: 'fallback because real config is incomplete',
        summary: 'אין קונפיג של real',
        recommendation: 'הצג תוצאה בטוחה',
        nextAction: 'התחל עם גיבוי',
        confidence: 'low',
      }),
    } as unknown as FixtureProviderService;
    const realProvider = {
      generate: jest.fn(),
    } as unknown as RealProviderService;

    const service = new ProviderGatewayService({ fixtureProvider, realProvider });

    const result = await service.generate(
      { prompt: 'טבעת כחולה', language: 'he' },
      [{ kind: 'real', enabled: true }],
    );

    expect(result.provider).toBe('fixture');
    expect(result.content).toBe('fallback because real config is incomplete');
    expect(realProvider.generate).not.toHaveBeenCalled();
  });

  // test 8 - fallback after invalid real response

  it('falls back to the fixture provider when the real provider returns an invalid response', async () => {
    const fixtureProvider = {
      generate: jest.fn().mockResolvedValue({
        provider: 'fixture',
        mode: 'fixture',
        content: 'safe fallback after invalid real output',
        summary: 'תגובה קבועה לאחר שגיאה',
        recommendation: 'הצג חלופה בטוחה',
        nextAction: 'המשך עם פלט קבוע',
        confidence: 'medium',
      }),
    } as unknown as FixtureProviderService;
    const realProvider = {
      generate: jest.fn().mockResolvedValue({
        provider: 'real',
        mode: 'real',
        content: '',
      }),
    } as unknown as RealProviderService;

    const service = new ProviderGatewayService({ fixtureProvider, realProvider });

    const result = await service.generate(
      { prompt: 'טבעת כחולה', language: 'he' },
      [{ kind: 'real', enabled: true, baseUrl: 'https://example.com/v1', modelName: 'gpt-4o-mini', apiKey: 'token' }],
    );

    expect(result.provider).toBe('fixture');
    expect(result.content).toBe('safe fallback after invalid real output');
    expect(fixtureProvider.generate).toHaveBeenCalledWith({ prompt: 'טבעת כחולה', language: 'he' });
  });

  // test 9 - accept a valid real response
  it('accepts a product-style response with summary, recommendation, nextAction, and confidence', async () => {
    const fixtureProvider = { generate: jest.fn() } as unknown as FixtureProviderService;
    const realProvider = {
      generate: jest.fn().mockResolvedValue({
        provider: 'real',
        mode: 'real',
        content: 'דבריי הראשוניים',
        summary: 'מוצג פריט רלוונטי',
        recommendation: 'הצג אפשרויות דומות',
        nextAction: 'בקש מידע נוסף מהמשתמש',
        confidence: 'medium',
        structuredAnswer: {
          role: 'buyer',
          language: 'he',
          intent: 'Find a blue ring matching the requested period and budget.',
          category: 'rings',
          missingFacts: ['budget', 'size', 'condition'],
          hasContactDetails: false,
          hasImages: false,
        },
      }),
    } as unknown as RealProviderService;

    const service = new ProviderGatewayService({ fixtureProvider, realProvider });

    const result = await service.generate(
      { prompt: 'טבעת כחולה', language: 'he' },
      [{ kind: 'real', enabled: true, baseUrl: 'https://example.com/v1', modelName: 'gpt-4o-mini', apiKey: 'token' }],
    );

    expect(result.provider).toBe('real');
    expect(result.summary).toBe('מוצג פריט רלוונטי');
    expect(result.recommendation).toBe('הצג אפשרויות דומות');
    expect(result.nextAction).toBe('בקש מידע נוסף מהמשתמש');
    expect(result.confidence).toBe('medium');
  });

  // test 10 - fallback after malformed payload

  it('falls back when the real provider returns a malformed payload shape', async () => {
    const fixtureProvider = {
      generate: jest.fn().mockResolvedValue({
        provider: 'fixture',
        mode: 'fixture',
        content: 'safe fallback for malformed payload',
        summary: 'חזרה ל-fixture',
        recommendation: 'הצג תוצאה בטוחה',
        nextAction: 'המשך במצב גיבוי',
        confidence: 'low',
      }),
    } as unknown as FixtureProviderService;
    const realProvider = {
      generate: jest.fn().mockResolvedValue({
        provider: 'real',
        unexpected: 'shape',
      }),
    } as unknown as RealProviderService;

    const service = new ProviderGatewayService({ fixtureProvider, realProvider });

    const result = await service.generate(
      { prompt: 'טבעת כחולה', language: 'he' },
      [{ kind: 'real', enabled: true, baseUrl: 'https://example.com/v1', modelName: 'gpt-4o-mini', apiKey: 'token' }],
    );

    expect(result.provider).toBe('fixture');
    expect(result.content).toBe('safe fallback for malformed payload');
  });
});
