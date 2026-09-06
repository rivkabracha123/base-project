import { FixtureProviderService } from './fixture-provider.service';
import { ProviderGatewayService } from './provider-gateway.service';
import { RealProviderService } from './real-provider.service';

//1 test - select the enabled provider (first try real)

describe('ProviderGatewayService', () => {
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

  //test 2 - fallback to fixture provider because error

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

  //test 3 - no real provider enabled so use fixture provider

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

  //test 4 - real provider enabled but missing config

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

  //test 5 - fixture provieder because real provider returns invalid response

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

  //test 6 - real provider returns valid  response
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

  //test 7 - real provider returns malformed payload shape

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
