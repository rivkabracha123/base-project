import { MAX_PROVIDER_PROMPT_LENGTH, RealProviderService, sanitizePrompt } from './real-provider.service';
//test real provider service
describe('RealProviderService', () => {
  it('calls the OpenAI-compatible endpoint and returns the model content', async () => {
    const modelResponse = {
      isRelevant: true,
      error: null,
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
      history: [{ prompt: 'I want a ring buyer@example.com', answer: 'What is your budget?' }],
    });
//make sure that the result equals the expected output
    expect(result.provider).toBe('real');
    expect(result.mode).toBe('real');
    expect(result.content).toBe(JSON.stringify(modelResponse));
    expect(result.structuredAnswer).toEqual(modelResponse.structuredAnswer);
    const sentMessages = JSON.parse(fetchMock.mock.calls[0][1].body).messages;
    expect(sentMessages.slice(1, 3)).toEqual([
      { role: 'user', content: 'I want a ring [contact removed]' },
      { role: 'assistant', content: 'What is your budget?' },
    ]);
    expect(sentMessages[3].role).toBe('user');
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
      'Contact me at buyer@example.com or 050-1234567. data:image/png;base64,abc123. https://example.com/signed?token=abc verification code: A1B2C3 api_key=secret-value',
    );

    expect(sanitized).not.toContain('buyer@example.com');
    expect(sanitized).not.toContain('050-1234567');
    expect(sanitized).not.toContain('https://example.com');
    expect(sanitized).not.toContain('A1B2C3');
    expect(sanitized).not.toContain('secret-value');
    expect(sanitized).toContain('[contact removed]');
    expect(sanitized).toContain('[image removed]');
    expect(sanitized).toContain('[url removed]');
    expect(sanitized).toContain('[verification code removed]');
    expect(sanitized).toContain('[credential removed]');
  });
//test remove characters
  it('removes control characters and caps the prompt sent to the provider', () => {
    const sanitized = sanitizePrompt(`safe\u0000 prompt${'x'.repeat(MAX_PROVIDER_PROMPT_LENGTH + 100)}`);

    expect(sanitized).not.toContain('\u0000');
    expect(sanitized).toHaveLength(MAX_PROVIDER_PROMPT_LENGTH);
  });
//test rejects restricted data
  it('rejects restricted data returned by the provider', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"summary":"contact buyer@example.com"}' } }],
      }),
    });

    await expect(
      new RealProviderService().generate({
        prompt: 'טבעת כחולה',
        baseUrl: 'https://example.com/v1',
        modelName: 'gpt-4o-mini',
        apiKey: 'test-key',
        fetchImpl: fetchMock as typeof fetch,
      }),
    ).rejects.toThrow('restricted contact or image data');
  });
});
