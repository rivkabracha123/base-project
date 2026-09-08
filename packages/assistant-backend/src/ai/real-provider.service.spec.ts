import { RealProviderService, sanitizePrompt } from './real-provider.service';
//test real provider service
describe('RealProviderService', () => {
  it('calls the OpenAI-compatible endpoint and returns the model content', async () => {
    const modelResponse = {
      summary: 'מוצג פריט רלוונטי',
      recommendation: 'הצג אפשרויות דומות',
      nextAction: 'בקש מידע נוסף',
      confidence: 'medium',
      structuredAnswer: {
        role: 'buyer',
        language: 'he',
        intent: 'Find a blue ring.',
        category: 'rings',
        periods: ['2021'],
        keywords: ['blue'],
        hasContactDetails: false,
        hasImages: false,
      },
    };

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(modelResponse) } }],
      }),
    });

    const service = new RealProviderService();

    const result = await service.generate({
      prompt: 'טבעת כחולה משנת 2021',
      language: 'he',
      baseUrl: 'https://example.com/v1',
      modelName: 'gpt-4o-mini',
      apiKey: 'test-key',
      fetchImpl: fetchMock as typeof fetch,
    });
//make sure that the result equals the expected output
    expect(result.provider).toBe('real');
    expect(result.mode).toBe('real');
    expect(result.content).toBe(JSON.stringify(modelResponse));
    expect(result.structuredAnswer).toEqual(modelResponse.structuredAnswer);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
  });
//test to remove contact details
  it('removes contact details and inline image data before sending the prompt', () => {
    const sanitized = sanitizePrompt(
      'Contact me at buyer@example.com or 050-1234567. data:image/png;base64,abc123',
    );

    expect(sanitized).not.toContain('buyer@example.com');
    expect(sanitized).not.toContain('050-1234567');
    expect(sanitized).toContain('[contact removed]');
    expect(sanitized).toContain('[image removed]');
  });
});
