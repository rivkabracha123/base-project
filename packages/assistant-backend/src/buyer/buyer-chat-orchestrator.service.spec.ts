import { ConfigService } from '@nestjs/config';
import { P4AiGenerateClient } from '../ai/p4-ai-generate.client';
import { BuyerChatOrchestratorService } from './buyer-chat-orchestrator.service';
import type { BuyerLotsResolverService } from './buyer-lots-resolver.service';
import { BuyerComparableSaleHistoryService } from './buyer-comparable-sale-history.service';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerHouseRecommendationService } from './buyer-house-recommendation.service';
import { BuyerP4BridgeService } from './buyer-p4-bridge.service';
import { BuyerP4FunctionExecutor } from './buyer-p4-function.executor';
import { BuyerSessionSearchService } from './buyer-session-search.service';
import { FixtureLotsSearchClient } from './fixture-lots-search.client';
import { findBuyerFixtureLot, resolveBuyerFixtureLots } from './fixture-lots.pool';
import type { SellerLeadsService } from '../seller-leads/seller-leads.service';

describe('BuyerChatOrchestratorService', () => {
  function createOrchestrator() {
    const config = {
      get: (key: string) => (key === 'AI_PROVIDER_MODE' ? 'fixture' : undefined),
    } as ConfigService;
    const p4 = new P4AiGenerateClient(config);
    const criteria = new BuyerCriteriaService();
    const bridge = new BuyerP4BridgeService(p4, criteria);
    const lotsResolver = {
      findLot: jest.fn(async (id: string) => findBuyerFixtureLot(id) ?? null),
      resolveLotPool: jest.fn(async (refs?: { id: string }[]) => resolveBuyerFixtureLots(refs)),
    } as unknown as BuyerLotsResolverService;
    const saleHistory = new BuyerComparableSaleHistoryService(lotsResolver);
    const executor = new BuyerP4FunctionExecutor(
      saleHistory,
      new BuyerSessionSearchService(new FixtureLotsSearchClient()),
      criteria,
      lotsResolver,
      new BuyerHouseRecommendationService({ rankHouses: jest.fn() } as unknown as SellerLeadsService, criteria),
    );
    return { orchestrator: new BuyerChatOrchestratorService(bridge, criteria, executor), criteria };
  }

  it('returns sessionId and a system update on first message (P4 fixture + criteria)', async () => {
    const { orchestrator } = createOrchestrator();

    const result = await orchestrator.handleMessage({
      message: 'The buyer wants a blue painting from the 19th century with a budget around $10k.',
      language: 'en',
    });

    expect(result.sessionId).toBeTruthy();
    expect(result.updates.length).toBeGreaterThanOrEqual(1);
    expect(result.updates[0]?.speaker).toBe('system');
  });
});
