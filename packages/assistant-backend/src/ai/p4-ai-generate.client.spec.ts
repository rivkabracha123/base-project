import { ConfigService } from '@nestjs/config';
import { P4AiGenerateClient } from './p4-ai-generate.client';

describe('P4AiGenerateClient', () => {
  it('preserves an explicit route block over a top-level ready flag', async () => {
    const config = { get: (key: string) => key === 'AI_PROVIDER_MODE' ? 'real' : 'http://localhost/ai' } as ConfigService;
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        readyForFunction: true,
        intentRoute: { intent: 'search_auction_lots', functionName: 'searchLots', readyForFunction: false, missingFields: ['category'] },
      }),
    } as Response);
    try {
      const result = await new P4AiGenerateClient(config).generateBuyerExtract({ prompt: 'find items', language: 'en' });
      expect(result.readyForFunction).toBe(false);
      expect(result.intentRoute.readyForFunction).toBe(false);
    } finally {
      fetchMock.mockRestore();
    }
  });
  it('returns fixture extract when AI_PROVIDER_MODE is fixture', async () => {
    const config = {
      get: (key: string) => (key === 'AI_PROVIDER_MODE' ? 'fixture' : undefined),
    } as ConfigService;
    const client = new P4AiGenerateClient(config);

    const result = await client.generateBuyerExtract({
      prompt: 'blue painting under $10k',
      language: 'en',
      selectedLot: null,
    });

    expect(result.extract.mode).toBe('fixture');
    expect(result.extract.content).toBe('blue painting under $10k');
    expect(result.readyForFunction).toBe(false);
  });
});
