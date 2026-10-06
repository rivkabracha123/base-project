import { ConfigService } from '@nestjs/config';
import { P4AiGenerateClient } from './p4-ai-generate.client';

describe('P4AiGenerateClient', () => {
  it('returns fixture extract when AI_PROVIDER_MODE is fixture', async () => {
    const config = {
      get: (key: string) => (key === 'AI_PROVIDER_MODE' ? 'fixture' : undefined),
    } as ConfigService;
    const client = new P4AiGenerateClient(config);

    const result = await client.generateBuyerExtract({
      role: 'buyer',
      userMessage: 'blue painting under $10k',
      language: 'en',
    });

    expect(result.extract.mode).toBe('fixture');
    expect(result.extract.content).toBe('blue painting under $10k');
    expect(result.readyForFunction).toBe(false);
  });
});
