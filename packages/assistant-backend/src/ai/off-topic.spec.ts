import { FixtureProviderService } from './fixture-provider.service';
import { ProviderGatewayService } from './provider-gateway.service';
import { RealProviderService } from './real-provider.service';
import { isExplicitlyOffTopic } from './off-topic';

describe('unrelated messages during an auction conversation', () => {
  it.each(['אני רוצה גם מתכון לעוגת קוקוס', 'Can you give me a cake recipe?'])('rejects %s without calling the real model', async prompt => {
    const realProvider = { generate: jest.fn() };
    const gateway = new ProviderGatewayService({
      fixtureProvider: new FixtureProviderService(),
      realProvider: realProvider as unknown as RealProviderService,
    });
    const result = await gateway.generate({
      role: 'seller', language: 'he', prompt,
      history: [{ prompt: 'I want to sell a signed painting in good condition', answer: 'What are its dimensions?' }],
    }, [{ kind: 'real', enabled: true, baseUrl: 'https://example.com', modelName: 'test', apiKey: 'synthetic' }]);
    expect(result.isRelevant).toBe(false);
    expect(result.error).toBeNull();
    expect(result).not.toHaveProperty('fallbackMode');
    expect(result.nextAction).toContain('הפרטים שכבר מסרת');
    expect(result.structuredAnswer.category).toBe('paintings');
    expect(realProvider.generate).not.toHaveBeenCalled();
  });

  it.each(['I want to buy an antique recipe book', 'אני רוצה למכור ספר מתכונים עתיק', 'מצב טוב אך עם שריטה בפינה', '60 על 80 סנטימטר'])('does not block item requests or short answers: %s', prompt => {
    expect(isExplicitlyOffTopic(prompt)).toBe(false);
  });
});
