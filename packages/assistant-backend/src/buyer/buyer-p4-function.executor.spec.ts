import type { P4AiGenerateResponse } from '../ai/p4-ai.types';
import { SHILAT_FUNCTION_COMPARABLE_SALE_HISTORY } from '../ai/p4-buyer-routing';
import { rankActiveHouses } from '../seller-leads/house-rank';
import { loadPreparedHouses } from '../seller-leads/house-rank-fixture';
import type { SellerLeadsService } from '../seller-leads/seller-leads.service';
import type { BuyerChatUpdate } from './buyer-chat-update';
import type { BuyerLotsResolverService } from './buyer-lots-resolver.service';
import { BuyerComparableSaleHistoryService } from './buyer-comparable-sale-history.service';
import { BuyerCriteriaService } from './buyer-criteria.service';
import {
  BuyerHouseRecommendationService,
  keepSpecialists,
  RANK_HOUSES_FUNCTION,
} from './buyer-house-recommendation.service';
import { BuyerP4FunctionExecutor } from './buyer-p4-function.executor';
import { BuyerSessionSearchService } from './buyer-session-search.service';
import { FixtureLotsSearchClient } from './fixture-lots-search.client';
import { findBuyerFixtureLot, resolveBuyerFixtureLots } from './fixture-lots.pool';

describe('BuyerP4FunctionExecutor', () => {
  function createExecutor() {
    const lotsResolver = {
      findLot: jest.fn(async (id: string) => findBuyerFixtureLot(id) ?? null),
      resolveLotPool: jest.fn(async (refs?: { id: string }[]) => resolveBuyerFixtureLots(refs)),
    } as unknown as BuyerLotsResolverService;
    const criteria = new BuyerCriteriaService();
    const sellerLeads = {
      rankHouses: jest.fn((item) => rankActiveHouses(loadPreparedHouses(), item)),
    } as unknown as SellerLeadsService;
    const executor = new BuyerP4FunctionExecutor(
      new BuyerComparableSaleHistoryService(lotsResolver),
      new BuyerSessionSearchService(new FixtureLotsSearchClient()),
      criteria,
      lotsResolver,
      new BuyerHouseRecommendationService(sellerLeads, criteria),
    );
    return { executor, sellerLeads };
  }

  function aiRoute(functionName: string, args: Record<string, unknown>): P4AiGenerateResponse {
    return {
      extract: {
        provider: 'fixture',
        mode: 'fixture',
        content: '',
        summary: '',
        recommendation: '',
        nextAction: '',
        confidence: 'low',
      },
      readyForFunction: true,
      intentRoute: { functionName, readyForFunction: true, arguments: args },
      functionParameters: null,
    };
  }

  it('runs getComparableSaleHistory when Shilat returns that functionName', async () => {
    const { executor } = createExecutor();
    const ai = aiRoute(SHILAT_FUNCTION_COMPARABLE_SALE_HISTORY, {
      selectedLot: { id: 'lot-history-upcoming-001', itemKey: 'abrabanel_commentary_example' },
      lots: [{ id: 'lot-history-upcoming-001' }, { id: 'lot-history-sold-001' }],
    });

    const updates: BuyerChatUpdate[] = [];
    const handled = await executor.execute(
      ai,
      { sessionId: 's1', language: 'he', criteriaComplete: false },
      updates,
    );

    expect(handled).toBe(true);
    expect(updates.some((u) => u.speaker === 'result-group')).toBe(true);
  });

  it('answers the buyer house question by calling the existing seller house ranking', async () => {
    const { executor, sellerLeads } = createExecutor();
    const updates: BuyerChatUpdate[] = [];

    const handled = await executor.execute(
      aiRoute(RANK_HOUSES_FUNCTION, { category: 'rare_books' }),
      { sessionId: 'no-session', language: 'he', criteriaComplete: false },
      updates,
    );

    expect(handled).toBe(true);
    expect(sellerLeads.rankHouses).toHaveBeenCalledWith({ category: 'rare_books' });
    const update = updates.find((u) => u.speaker === 'house-recommendations');
    expect(update).toEqual({
      speaker: 'house-recommendations',
      title: 'בתי מכירות שמתמחים בתחום הזה',
      ranking: keepSpecialists(rankActiveHouses(loadPreparedHouses(), { category: 'rare_books' }), 'rare_books'),
    });
  });

  it('says no house was found when none specializes in the field', async () => {
    const { executor } = createExecutor();
    const updates: BuyerChatUpdate[] = [];

    await executor.execute(
      aiRoute(RANK_HOUSES_FUNCTION, { category: 'painting' }),
      { sessionId: 'no-session', language: 'he', criteriaComplete: false },
      updates,
    );

    expect(updates).toEqual([
      { speaker: 'no-results', text: 'לא נמצא בית מכירות פעיל שמתמחה בתחום הזה.' },
    ]);
  });

  it('asks for the field when no category is known', async () => {
    const { executor, sellerLeads } = createExecutor();
    const updates: BuyerChatUpdate[] = [];

    const handled = await executor.execute(
      aiRoute(RANK_HOUSES_FUNCTION, {}),
      { sessionId: 'no-session', language: 'en', criteriaComplete: false },
      updates,
    );

    expect(handled).toBe(true);
    expect(sellerLeads.rankHouses).not.toHaveBeenCalled();
    expect(updates).toEqual([
      expect.objectContaining({ speaker: 'error', code: 'house_ranking_missing_category' }),
    ]);
  });
});
