import { RealProviderService } from './real-provider.service';

describe('Groq buyer structured output', () => {
  const response = {
    isRelevant: true, error: null, summary: 'מחפשת ציור', recommendation: 'לחפש ציורים',
    nextAction: 'האם יש תקופה מועדפת?', confidence: 'low',
    structuredAnswer: {
      role: 'buyer', language: 'he', intent: 'Find a painting', category: 'paintings',
      creators: null, periods: null, keywords: null, geography: null,
      price: { min: null, max: 500, currency: 'ILS' },
      hasContactDetails: false, hasImages: false,
      completionState: {
        fields: { period: { required: false, status: 'missing', value: null } },
        blockingFields: [], readyForFunctions: true,
      },
    },
  };

  function fetchFor(payload: unknown) {
    return jest.fn().mockResolvedValue({ ok: true, json: async () => ({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    }) });
  }

  it('requests strict schema and maps nullable optionals while keeping missing-field values', async () => {
    const fetchMock = fetchFor(response);
    const result = await new RealProviderService().generate({
      role: 'buyer', language: 'he', prompt: 'אני מחפשת ציור עד 500 שקלים',
      baseUrl: 'https://api.groq.com/openai/v1', modelName: 'openai/gpt-oss-120b',
      apiKey: 'synthetic-test-key', fetchImpl: fetchMock,
    });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.response_format.type).toBe('json_schema');
    expect(sent.response_format.json_schema.strict).toBe(true);
    expect(result.provider).toBe('real');
    expect(result.structuredAnswer).toEqual(expect.objectContaining({
      language: 'he', price: { max: 500, currency: 'ILS' },
      completionState: response.structuredAnswer.completionState,
    }));
    expect(result.structuredAnswer).not.toHaveProperty('periods');
  });

  it('still rejects responses with a missing completion value', async () => {
    const invalid = JSON.parse(JSON.stringify(response));
    delete invalid.structuredAnswer.completionState.fields.period.value;
    await expect(new RealProviderService().generate({
      role: 'buyer', language: 'he', prompt: 'ציור',
      baseUrl: 'https://api.groq.com/openai/v1', modelName: 'openai/gpt-oss-120b',
      apiKey: 'synthetic-test-key', fetchImpl: fetchFor(invalid),
    })).rejects.toThrow('schema validation');
  });
});
