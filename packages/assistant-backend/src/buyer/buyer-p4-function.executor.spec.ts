import type { P4AiGenerateResponse } from '../ai/p4-ai.types';
import { SHILAT_FUNCTION_COMPARABLE_SALE_HISTORY, SHILAT_INTENT_SEARCH_SIMILAR_LOTS } from '../ai/p4-buyer-routing';
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

  describe('similar items in other categories', () => {
    const similarLot = findBuyerFixtureLot('lot-history-sold-001');

    // P4 reply for the follow-up question: similar-lots intent with no function name.
    const similarAi: P4AiGenerateResponse = {
      extract: {
        provider: 'fixture',
        mode: 'fixture',
        content: '',
        summary: '',
        recommendation: '',
        nextAction: '',
        confidence: 'low',
      },
      readyForFunction: false,
      intentRoute: {
        intent: SHILAT_INTENT_SEARCH_SIMILAR_LOTS,
        functionName: null,
        readyForFunction: false,
        missingFields: ['similarLotsFunction'],
      },
      functionParameters: null,
    };

    function setup() {
      const lotsResolver = {
        findLot: jest.fn(async () => null),
        resolveLotPool: jest.fn(async () => []),
      } as unknown as BuyerLotsResolverService;
      const sessionSearch = new BuyerSessionSearchService(new FixtureLotsSearchClient());
      const searchOtherCategories = jest.spyOn(sessionSearch, 'searchOtherCategoriesForSession');
      const searchForSession = jest.spyOn(sessionSearch, 'searchForSession');
      const executor = new BuyerP4FunctionExecutor(
        new BuyerComparableSaleHistoryService(lotsResolver),
        sessionSearch,
        new BuyerCriteriaService(),
        lotsResolver,
        {} as BuyerHouseRecommendationService,
      );
      const updates: BuyerChatUpdate[] = [];
      const run = () => executor.execute(similarAi, { sessionId: 's1', language: 'he', criteriaComplete: true }, updates);
      return { searchOtherCategories, searchForSession, updates, run };
    }

    it('asks the session search for other categories and never runs the regular search', async () => {
      const { searchOtherCategories, searchForSession, run } = setup();
      searchOtherCategories.mockResolvedValue({ kind: 'unmatched', message: 'אין' });

      const handled = await run();

      expect(handled).toBe(true);
      expect(searchOtherCategories).toHaveBeenCalledTimes(1);
      expect(searchOtherCategories).toHaveBeenCalledWith('s1');
      expect(searchForSession).not.toHaveBeenCalled();
    });

    it('pushes a results-found line and one result-group per group', async () => {
      if (!similarLot) throw new Error('fixture lot missing');
      const { searchOtherCategories, updates, run } = setup();
      searchOtherCategories.mockResolvedValue({
        kind: 'results',
        groups: [
          {
            title: 'מכירות קרובות',
            lots: [similarLot],
            matchReasons: { [similarLot.id]: [{ field: 'creators', detail: 'Yitzhak Abrabanel' }] },
          },
          { title: 'מכירות קודמות', lots: [similarLot, similarLot] },
        ],
      });

      await run();

      expect(updates.map((update) => update.speaker)).toEqual(['results-found', 'result-group', 'result-group']);
      expect(updates[0]).toMatchObject({ text: expect.stringContaining('3') });
      // Marked as other-categories for the chat, with the reasons passed through only where the search gave any.
      expect(updates[1]).toEqual({
        speaker: 'result-group',
        title: 'מכירות קרובות',
        lots: [similarLot],
        variant: 'other-categories',
        matchReasons: { [similarLot.id]: [{ field: 'creators', detail: 'Yitzhak Abrabanel' }] },
      });
      expect(updates[2]).toEqual({
        speaker: 'result-group',
        title: 'מכירות קודמות',
        lots: [similarLot, similarLot],
        variant: 'other-categories',
      });
    });

    it('pushes no-results with the service message when nothing matched', async () => {
      const { searchOtherCategories, updates, run } = setup();
      searchOtherCategories.mockResolvedValue({ kind: 'unmatched', message: 'לא מצאנו פריטים דומים' });

      await run();

      expect(updates).toEqual([{ speaker: 'no-results', text: 'לא מצאנו פריטים דומים' }]);
    });

    it('pushes a system line asking for more details on insufficient criteria', async () => {
      const { searchOtherCategories, updates, run } = setup();
      searchOtherCategories.mockResolvedValue({ kind: 'insufficient-criteria', message: 'צריך פרט נוסף' });

      await run();

      expect(updates).toEqual([{ speaker: 'system', text: 'צריך פרט נוסף' }]);
    });

    it('pushes a similar_failed error when the search throws', async () => {
      const { searchOtherCategories, updates, run } = setup();
      searchOtherCategories.mockRejectedValue(new Error('lots search down'));

      const handled = await run();

      expect(handled).toBe(true);
      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({ speaker: 'error', code: 'similar_failed' });
    });

    it('keeps the similar_not_wired error while the cross-category search is unavailable', async () => {
      const { searchOtherCategories, updates, run } = setup();
      searchOtherCategories.mockResolvedValue({ kind: 'unavailable' });

      await run();

      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({ speaker: 'error', code: 'similar_not_wired' });
    });
  });
});
