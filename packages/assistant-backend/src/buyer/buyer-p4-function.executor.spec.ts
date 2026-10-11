import type { P4AiGenerateResponse } from '../ai/p4-ai.types';
import { SHILAT_FUNCTION_COMPARABLE_SALE_HISTORY, SHILAT_INTENT_SEARCH_SIMILAR_LOTS } from '../ai/p4-buyer-routing';
import type { BuyerChatUpdate } from './buyer-chat-update';
import type { BuyerLotsResolverService } from './buyer-lots-resolver.service';
import { BuyerComparableSaleHistoryService } from './buyer-comparable-sale-history.service';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerP4FunctionExecutor } from './buyer-p4-function.executor';
import { BuyerSessionSearchService } from './buyer-session-search.service';
import { FixtureLotsSearchClient } from './fixture-lots-search.client';
import { findBuyerFixtureLot, resolveBuyerFixtureLots } from './fixture-lots.pool';

describe('BuyerP4FunctionExecutor', () => {
  it('runs getComparableSaleHistory when Shilat returns that functionName', async () => {
    const lotsResolver = {
      findLot: jest.fn(async (id: string) => findBuyerFixtureLot(id) ?? null),
      resolveLotPool: jest.fn(async (refs?: { id: string }[]) => resolveBuyerFixtureLots(refs)),
    } as unknown as BuyerLotsResolverService;
    const saleHistory = new BuyerComparableSaleHistoryService(lotsResolver);
    const executor = new BuyerP4FunctionExecutor(
      saleHistory,
      new BuyerSessionSearchService(new FixtureLotsSearchClient()),
      new BuyerCriteriaService(),
      lotsResolver,
    );

    const ai: P4AiGenerateResponse = {
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
      intentRoute: {
        functionName: SHILAT_FUNCTION_COMPARABLE_SALE_HISTORY,
        readyForFunction: true,
        arguments: {
          selectedLot: { id: 'lot-history-upcoming-001', itemKey: 'abrabanel_commentary_example' },
          lots: [{ id: 'lot-history-upcoming-001' }, { id: 'lot-history-sold-001' }],
        },
      },
      functionParameters: null,
    };

    const updates: import('./buyer-chat-update').BuyerChatUpdate[] = [];
    const handled = await executor.execute(
      ai,
      { sessionId: 's1', language: 'he', criteriaComplete: false },
      updates,
    );

    expect(handled).toBe(true);
    expect(updates.some((u) => u.speaker === 'result-group')).toBe(true);
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
