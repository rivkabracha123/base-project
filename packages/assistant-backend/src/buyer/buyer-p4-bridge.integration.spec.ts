import { ConfigService } from '@nestjs/config';
import { P4AiGenerateClient } from '../ai/p4-ai-generate.client';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerP4BridgeService } from './buyer-p4-bridge.service';

describe('BuyerP4BridgeService', () => {
  it('opens a conversation through P4 fixture and returns chat + ai metadata', async () => {
    const config = {
      get: (key: string) => (key === 'AI_PROVIDER_MODE' ? 'fixture' : undefined),
    } as ConfigService;
    const p4 = new P4AiGenerateClient(config);
    const criteria = new BuyerCriteriaService();
    const bridge = new BuyerP4BridgeService(p4, criteria);

    const result = await bridge.openConversation({
      message: 'The buyer wants a blue painting from the 19th century with a budget around $10k.',
      language: 'en',
    });

    expect(result.chat.sessionId).toBeTruthy();
    expect(result.chat.text.length).toBeGreaterThan(0);
    expect(result.ai.extract.mode).toBe('fixture');
    expect(criteria.getCriteriaForSession(result.chat.sessionId).categories).toContain('painting');
  });

  it('returns searchLots readiness when criteria have no missing fields', async () => {
    const config = {
      get: (key: string) => (key === 'AI_PROVIDER_MODE' ? 'fixture' : undefined),
    } as ConfigService;
    const p4 = new P4AiGenerateClient(config);
    const criteria = new BuyerCriteriaService();
    const bridge = new BuyerP4BridgeService(p4, criteria);

    const opened = await bridge.openConversation({
      message: 'The buyer wants a blue painting from the 19th century with a budget around $10k.',
      language: 'en',
    });

    while (criteria.getSessionResponse(opened.chat.sessionId).conversation.missing.length > 0) {
      criteria.continueCriteriaSessionFromChat({
        id: `skip-${Date.now()}`,
        sessionId: opened.chat.sessionId,
        speaker: 'buyer',
        skipped: true,
        date: new Date().toISOString(),
      });
    }

    const readiness = await bridge.evaluateSearchReadiness(opened.chat.sessionId);
    expect(readiness.readyForFunction).toBe(true);
    expect(readiness.functionName).toBe('searchLots');
  });
});
