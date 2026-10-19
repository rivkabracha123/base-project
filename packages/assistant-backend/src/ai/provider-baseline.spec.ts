import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { AiRole } from './ai.dto';
import { isBuyerHandoffContract } from './buyer-handoff';
import { FixtureProviderService } from './fixture-provider.service';
import { ProviderGatewayService } from './provider-gateway.service';
import { RealProviderService } from './real-provider.service';
import { isSellerHandoffContract } from './seller-handoff';

// P4 Week 6 baseline: replay recorded provider replies through the real adapter and gateway.
// Reproduce: npm test -w @monabid/assistant-backend -- src/ai/provider-baseline
type BaselineCase = {
  id: string;
  role: AiRole;
  language: 'he' | 'en';
  prompt: string;
  reply: { status?: number; content?: unknown; networkError?: boolean };
  expected: { outcome: 'accepted' | 'unavailable'; reason?: string; providerCalls: number };
};

const corpus = JSON.parse(readFileSync(
  resolve(__dirname, '../../../../fixtures/ai-responses/provider-baseline.json'), 'utf8',
)) as { model: { baseUrl: string; modelName: string }; cases: BaselineCase[] };

async function replay(entry: BaselineCase) {
  const fetchImpl = jest.fn(async () => {
    if (entry.reply.networkError) throw new TypeError('fetch failed');
    const content = typeof entry.reply.content === 'string' ? entry.reply.content : JSON.stringify(entry.reply.content);
    const status = entry.reply.status ?? 200;
    return {
      ok: status < 400,
      status,
      text: async () => content,
      json: async () => ({ choices: [{ message: { content } }] }),
    } as unknown as Response;
  });
  const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  const gateway = new ProviderGatewayService({ fixtureProvider: new FixtureProviderService(), realProvider: new RealProviderService() });
  try {
    const response = await gateway.generate(
      { prompt: entry.prompt, role: entry.role, language: entry.language, fetchImpl } as never,
      [{ kind: 'real', enabled: true, baseUrl: corpus.model.baseUrl, modelName: corpus.model.modelName, apiKey: 'test-key' }],
    );
    return { outcome: 'accepted' as const, providerCalls: fetchImpl.mock.calls.length, response, error: undefined, logs: [] as string[] };
  } catch (error) {
    const logs = warn.mock.calls.map((call) => String(call[0]));
    const reason = logs.at(-1)?.replace(/^Falling back to guided input: /, '');
    return { outcome: 'unavailable' as const, reason, providerCalls: fetchImpl.mock.calls.length, response: undefined, error, logs };
  } finally {
    warn.mockRestore();
  }
}

describe('P4 provider baseline (recorded replies, no hosted model)', () => {
  it.each(corpus.cases.map((entry) => [entry.id, entry] as const))('%s', async (_id, entry) => {
    const result = await replay(entry);

    expect({ outcome: result.outcome, reason: result.reason, providerCalls: result.providerCalls })
      .toEqual({ outcome: entry.expected.outcome, reason: entry.expected.reason, providerCalls: entry.expected.providerCalls });
    if (result.outcome === 'accepted') {
      const contract = entry.role === 'buyer' ? isBuyerHandoffContract : isSellerHandoffContract;
      expect(contract(result.response!.structuredAnswer)).toBe(true);
      expect(result.response!.provider).toBe('real');
    } else {
      // B2 and S1 switch to guided input on exactly this error.
      expect(result.error).toBeInstanceOf(ServiceUnavailableException);
      expect(result.logs.join('\n')).not.toMatch(/test-key|dana@example\.com|api\.openai\.com/);
    }
  });

  it('matches the recorded baseline totals', async () => {
    // Sequential: each replay spies on the shared Logger prototype.
    const results = [];
    for (const entry of corpus.cases) results.push(await replay(entry));
    const totals = {
      cases: results.length,
      accepted: results.filter((result) => result.outcome === 'accepted').length,
      rejectedMalformed: results.filter((result) => result.reason?.startsWith('invalid_response')).length,
      unavailableOrLimited: results.filter((result) => result.outcome === 'unavailable' && !result.reason?.startsWith('invalid_response')).length,
      providerCalls: results.reduce((sum, result) => sum + result.providerCalls, 0),
    };
    // Measured with this corpus; see docs/ai-provider-baseline.md. Not a quality threshold.
    expect(totals).toEqual({ cases: 14, accepted: 4, rejectedMalformed: 7, unavailableOrLimited: 3, providerCalls: 23 });
  });
});
