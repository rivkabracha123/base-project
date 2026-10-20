import { MAX_PROVIDER_PROMPT_LENGTH, RealProviderService, sanitizePrompt } from './real-provider.service';
//test real provider service
describe('RealProviderService', () => {
  it('requires structured seller output from OpenAI without unsupported reasoning options', async () => {
    const envelope = { isRelevant: true, error: null, summary: 'Auction information', recommendation: 'Verify the sale record',
      nextAction: 'Ask about auction history', confidence: 'low', functionCall: { functionToRun: null, argumentsJson: null },
      structuredAnswer: { role: 'seller', language: 'en', intent: 'general_information', category: 'unknown', item: {},
        missingFacts: [], confirmedFacts: [], uncertainFacts: [], sellerConfirmation: { required: true, status: 'pending' },
        hasContactDetails: false, hasImages: false } };
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(envelope) } }] }) });
    await new RealProviderService().generate({ prompt: 'What is the auction record?', role: 'seller',
      baseUrl: 'https://api.openai.com/v1', modelName: 'gpt-4.1-mini', apiKey: 'test', fetchImpl: fetchMock });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.schema.properties.structuredAnswer.properties.role.enum).toEqual(['seller']);
    expect(body.reasoning_effort).toBeUndefined();
  });
  it.each([
    ['gpt-4o-mini', 'json_schema'],
    ['gpt-4o-mini-2024-07-18', 'json_schema'],
    ['gpt-4.1', 'json_schema'],
    ['gpt-3.5-turbo', 'json_object'],
  ])('uses %s with %s buyer output', async (modelName, format) => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) });
    await new RealProviderService().generate({ prompt: 'Rare books', role: 'buyer',
      baseUrl: 'https://api.openai.com/v1', modelName, apiKey: 'test', fetchImpl: fetchMock }).catch(() => undefined);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).response_format.type).toBe(format);
  });
  it('writes free text without a JSON response format', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true,
      json: async () => ({ choices: [{ message: { content: '  כתב יד הלכתי על קלף.  ' } }] }) });
    const text = await new RealProviderService().generateText({ prompt: 'Describe the item', language: 'he',
      baseUrl: 'https://api.openai.com/v1', modelName: 'gpt-4o-mini', apiKey: 'test', fetchImpl: fetchMock });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(text).toBe('כתב יד הלכתי על קלף.');
    expect(body.response_format).toBeUndefined();
    expect(body.messages[0].content).toContain('Write only in Hebrew');
  });
  it('normalizes Hebrew measurement units and labels from the model', async () => {
    const structuredAnswer = {
      role: 'seller', language: 'he', intent: 'Sell a manuscript', category: 'rare_books',
      item: { title: null, condition: null, markings: null, signature: null, provenance: null, notes: null,
        dimensions: { values: [{ label: 'אורך', value: 35, unit: 'ס"מ' }, { label: 'רוחב', value: 25, unit: 'ס״מ' }] } },
      missingFacts: [], confirmedFacts: [], uncertainFacts: [],
      sellerConfirmation: { required: true, status: 'pending' }, hasContactDetails: false, hasImages: false,
    };
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
      isRelevant: true, error: null, summary: 'כתב יד.', recommendation: 'נמשיך.', nextAction: 'מה המצב?', confidence: 'low',
      structuredAnswer, functionCall: { functionToRun: null, argumentsJson: null },
    }) } }] }) });
    const result = await new RealProviderService().generate({ prompt: '35 על 25 ס"מ', role: 'seller', language: 'he',
      baseUrl: 'https://api.openai.com/v1', modelName: 'gpt-4o-mini', apiKey: 'test', fetchImpl: fetchMock });
    expect((result.structuredAnswer as { item: { dimensions: unknown } }).item.dimensions).toEqual({ values: [
      { label: 'length', value: 35, unit: 'cm' }, { label: 'width', value: 25, unit: 'cm' }] });
  });
  it.each([null, { values: [{ label: 'ring_size', value: 8, unit: 'size' }] }])('accepts strict seller measurements %j', async dimensions => {
    const structuredAnswer = {
      role: 'seller', language: 'en', intent: 'Sell a ring', category: 'rings',
      item: { title: 'Blue ring', dimensions, condition: null, markings: null, signature: null, provenance: null, notes: null },
      missingFacts: ['condition'], confirmedFacts: [], uncertainFacts: [],
      sellerConfirmation: { required: true, status: 'pending' }, hasContactDetails: false, hasImages: false,
    };
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
      isRelevant: true, error: null, summary: 'A blue ring.', recommendation: 'Collect item details.',
      nextAction: 'What is its condition?', confidence: 'low', structuredAnswer,
      functionCall: { functionToRun: 'rankSellerHouses', argumentsJson: JSON.stringify({ category: 'rings' }) },
    }) } }] }) });
    const result = await new RealProviderService().generate({ prompt: 'Blue ring', role: 'seller',
      baseUrl: 'https://api.groq.com/openai/v1', modelName: 'openai/gpt-oss-120b', apiKey: 'test', fetchImpl: fetchMock });
    expect(result.provider).toBe('real');
    expect(result.functionCall).toEqual({ functionToRun: 'rankSellerHouses', object: { category: 'rings' } });
    expect((result.structuredAnswer as { item: unknown }).item).toEqual({ title: 'Blue ring', ...(dimensions ? { dimensions } : {}) });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format.json_schema.name).toBe('seller_response');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema.required).toContain('functionCall');
  });
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

  it('keeps year ranges and currency amounts that look like phone numbers', () => {
    for (const fact of ['from 1850-1900', 'period 1850 - 1900', 'budget 1 000 000 dollars', 'עד 1 000 000 ש"ח',
      'up to $2 500 000', 'עד 100000 דולר', 'budget 1.000.000 EUR']) {
      expect(sanitizePrompt(fact)).toBe(fact);
    }
  });

  it('still removes phone numbers, including ones that resemble years or amounts', () => {
    for (const phone of ['call 050-123-4567', 'call 054 123 4567', '+972 54 123 4567', 'call 1 800 123 456',
      'call 1900-1850', 'call 03.123.4567', 'call 1 000 000']) {
      expect(sanitizePrompt(phone)).toContain('[contact removed]');
    }
  });

  it('accepts a reply that echoes a year range but rejects one with a phone number', async () => {
    const reply = (summary: string) => jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
      isRelevant: true, error: null, summary, recommendation: 'Search now.', nextAction: 'Any budget?', confidence: 'low',
      structuredAnswer: { role: 'buyer', language: 'en', intent: 'search', category: 'paintings', hasContactDetails: false, hasImages: false },
    }) } }] }) });
    const generate = (fetchImpl: jest.Mock) => new RealProviderService().generate({ prompt: 'paintings 1850-1900', role: 'buyer',
      baseUrl: 'https://example.com/v1', modelName: 'm', apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(generate(reply('Paintings from 1850-1900.'))).resolves.toMatchObject({ summary: 'Paintings from 1850-1900.' });
    await expect(generate(reply('Call 050-123-4567.'))).rejects.toThrow('restricted contact or image data');
  });

  it('aborts a provider call that does not answer within the timeout', async () => {
    const fetchImpl = jest.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
    }));
    await expect(new RealProviderService().generate({ prompt: 'a ring', role: 'buyer', baseUrl: 'https://example.com/v1',
      modelName: 'm', apiKey: 'k', timeoutMs: 50, fetchImpl: fetchImpl as unknown as typeof fetch }))
      .rejects.toMatchObject({ name: 'TimeoutError' });
  });
});
