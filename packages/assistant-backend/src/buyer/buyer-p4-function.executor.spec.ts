import type { P4AiGenerateResponse } from '../ai/p4-ai.types';
import {
  SHILAT_FUNCTION_COMPARABLE_SALE_HISTORY,
  SHILAT_FUNCTION_GET_LOT_BY_ID,
  SHILAT_FUNCTION_PRICE_TREND,
  SHILAT_INTENT_SEARCH_SIMILAR_LOTS,
} from '../ai/p4-buyer-routing';
import type { BuyerChatUpdate } from './buyer-chat-update';
import type { BuyerLotsResolverService } from './buyer-lots-resolver.service';
import type { LotsService } from '../lots/lots.service';
import { BuyerComparableSaleHistoryService } from './buyer-comparable-sale-history.service';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerP4FunctionExecutor } from './buyer-p4-function.executor';
import { BuyerSearchExecutionService } from './buyer-search-execution.service';
import { BuyerSessionSearchService } from './buyer-session-search.service';
import { DefaultBuyerResultsPresentationService } from './default-buyer-results-presentation.service';
import type { BuyerResultsPresentationPort } from './buyer-results-presentation.port';
import { FixtureLotsSearchClient } from './fixture-lots-search.client';
import { findBuyerFixtureLot, resolveBuyerFixtureLots } from './fixture-lots.pool';

describe('BuyerP4FunctionExecutor', () => {
  it('does not execute a price trend when P4 says it is not ready', async () => {
    const presentation = { presentSearchResults: jest.fn(), presentPriceTrend: jest.fn() };
    const executor = new BuyerP4FunctionExecutor({} as never, presentation, new BuyerCriteriaService(), {} as never);
    const ai = { intentRoute: { functionName: 'getPriceTrend', readyForFunction: false }, readyForFunction: false } as P4AiGenerateResponse;
    expect(await executor.execute(ai, { sessionId: 's1', language: 'en', criteriaComplete: false }, [])).toBe(false);
    expect(presentation.presentPriceTrend).not.toHaveBeenCalled();
  });
  const extract: P4AiGenerateResponse['extract'] = {
    provider: 'fixture', mode: 'fixture', content: '', summary: '',
    recommendation: '', nextAction: '', confidence: 'low',
  };
  it('asks for criteria instead of reporting no results when a search cannot run', async () => {
    const executor = new BuyerP4FunctionExecutor(
      {} as BuyerComparableSaleHistoryService,
      { presentSearchResults: jest.fn() } as unknown as BuyerResultsPresentationPort,
      { getCriteriaReview: () => ({ summary: 'Review' }), getCriteriaForSession: () => ({ categories: [] }) } as unknown as BuyerCriteriaService,
      {} as BuyerLotsResolverService,
    );
    const updates: import('./buyer-chat-update').BuyerChatUpdate[] = [];
    const ai: P4AiGenerateResponse = { extract, readyForFunction: true, functionParameters: null,
      intentRoute: { functionName: 'searchLots', readyForFunction: true, missingFields: [] } };
    await executor.execute(ai, { sessionId: 's1', language: 'en', criteriaComplete: true }, updates);
    expect(updates).toContainEqual(expect.objectContaining({ speaker: 'system' }));
    expect(updates.some(update => update.speaker === 'no-results' || update.speaker === 'results-found')).toBe(false);
  });
  it('does not execute search when P4 blocks it, even with complete B2 criteria', async () => {
    const search = { presentSearchResults: jest.fn() };
    const executor = new BuyerP4FunctionExecutor(
      {} as BuyerComparableSaleHistoryService,
      search as unknown as BuyerResultsPresentationPort,
      new BuyerCriteriaService(),
      {} as BuyerLotsResolverService,
    );
    const ai = {
      extract, readyForFunction: false, functionParameters: null,
      intentRoute: { intent: 'search_auction_lots', functionName: 'searchLots', readyForFunction: false, missingFields: ['category'] },
    } as P4AiGenerateResponse;
    expect(await executor.execute(ai, { sessionId: 's1', language: 'he', criteriaComplete: true }, [])).toBe(false);
    expect(search.presentSearchResults).not.toHaveBeenCalled();
  });
  it('reads the id argument emitted by the P4 details router without extra context', async () => {
    const lot = findBuyerFixtureLot('lot-history-upcoming-001');
    const resolver = { findLot: jest.fn(async () => lot) };
    const executor = new BuyerP4FunctionExecutor(
      {} as BuyerComparableSaleHistoryService, {} as BuyerResultsPresentationPort,
      new BuyerCriteriaService(), resolver as unknown as BuyerLotsResolverService,
    );
    const ai = {
      extract, readyForFunction: true, functionParameters: null,
      intentRoute: { functionName: 'getLotById', readyForFunction: true, arguments: { id: 'lot-history-upcoming-001' } },
    } as P4AiGenerateResponse;
    const updates: import('./buyer-chat-update').BuyerChatUpdate[] = [];
    expect(await executor.execute(ai, { sessionId: 's1', language: 'he', criteriaComplete: false }, updates)).toBe(true);
    expect(resolver.findLot).toHaveBeenCalledWith('lot-history-upcoming-001');
    expect(updates[0]?.speaker).toBe('result-group');
  });
  function createLotsResolver(): BuyerLotsResolverService {
    return {
      findLot: jest.fn(async (id: string) => findBuyerFixtureLot(id) ?? null),
    } as unknown as BuyerLotsResolverService;
  }

  function createSaleHistory(): BuyerComparableSaleHistoryService {
    const lotsService = {
      findOne: jest.fn(async (id: string) => findBuyerFixtureLot(id)),
      findSaleHistoryByItemKey: jest.fn(async () => resolveBuyerFixtureLots().filter((lot) => lot.status === 'sold')),
    } as unknown as LotsService;
    return new BuyerComparableSaleHistoryService(lotsService);
  }
  it('runs getComparableSaleHistory when Shilat returns that functionName', async () => {
    const lotsResolver = {
      findLot: jest.fn(async (id: string) => findBuyerFixtureLot(id) ?? null),
      resolveLotPool: jest.fn(async (refs?: { id: string }[]) => resolveBuyerFixtureLots(refs)),
    } as unknown as BuyerLotsResolverService;
    const lotsService = {
      findOne: jest.fn(async (id: string) => findBuyerFixtureLot(id)),
      findSaleHistoryByItemKey: jest.fn(async () => resolveBuyerFixtureLots().filter((lot) => lot.status === 'sold')),
    } as unknown as LotsService;
    const saleHistory = new BuyerComparableSaleHistoryService(lotsService);
    const presentation = new DefaultBuyerResultsPresentationService(
      new BuyerSearchExecutionService(new FixtureLotsSearchClient()),
    );
    const executor = new BuyerP4FunctionExecutor(
      saleHistory,
      presentation,
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
    expect(updates.some((u) => u.speaker === 'sale-history')).toBe(true);
  });

  it('runs getLotById and returns the selected canonical lot to the chat', async () => {
    const lotsResolver = createLotsResolver();
    const executor = new BuyerP4FunctionExecutor(
      createSaleHistory(),
      new DefaultBuyerResultsPresentationService(new BuyerSearchExecutionService(new FixtureLotsSearchClient())),
      new BuyerCriteriaService(),
      lotsResolver,
    );
    const updates: import('./buyer-chat-update').BuyerChatUpdate[] = [];

    const handled = await executor.execute({
      extract: { provider: 'fixture', mode: 'fixture', content: '', summary: '', recommendation: '', nextAction: '', confidence: 'low' },
      readyForFunction: true,
      intentRoute: { functionName: SHILAT_FUNCTION_GET_LOT_BY_ID, readyForFunction: true, arguments: { lotId: 'lot-history-upcoming-001' } },
      functionParameters: null,
    }, { sessionId: 's1', language: 'en', criteriaComplete: false }, updates);

    expect(handled).toBe(true);
    expect(updates).toContainEqual(expect.objectContaining({ speaker: 'result-group' }));
  });

  it('runs getPriceTrend with the previous B3 result IDs and relays its callback', async () => {
    const lotsResolver = createLotsResolver();
    const sampleLots = resolveBuyerFixtureLots().slice(0, 2);
    const criteria = { getCriteriaForSession: jest.fn(() => ({ categories: ['rare_books'] })) };
    const presentation: BuyerResultsPresentationPort = {
      presentSearchResults: jest.fn(),
      presentPriceTrend: jest.fn(async ({ onUpdate }) => {
        onUpdate({
          type: 'price_trend',
          title: 'Price trend for matching lots',
          lots: sampleLots,
          points: [{ lotId: sampleLots[0]!.id, saleDate: '2024-01-01', title: 'Evidence', price: { amount: 100, currency: 'USD' } }],
        });
        return { lots: sampleLots, points: [] };
      }),
    };
    const executor = new BuyerP4FunctionExecutor(
      createSaleHistory(), presentation, criteria as unknown as BuyerCriteriaService, lotsResolver,
    );
    const updates: import('./buyer-chat-update').BuyerChatUpdate[] = [];

    const handled = await executor.execute({
      extract: { provider: 'fixture', mode: 'fixture', content: '', summary: '', recommendation: '', nextAction: '', confidence: 'low' },
      readyForFunction: true,
      intentRoute: { functionName: SHILAT_FUNCTION_PRICE_TREND, readyForFunction: true },
      functionParameters: null,
    }, { sessionId: 's1', language: 'en', criteriaComplete: false, p4Context: { lots: sampleLots.map((lot) => ({ id: lot.id })) } }, updates);

    expect(handled).toBe(true);
    expect(presentation.presentPriceTrend).toHaveBeenCalledWith(expect.objectContaining({ lots: sampleLots.map((lot) => ({ id: lot.id })) }));
    expect(updates).toContainEqual(expect.objectContaining({ speaker: 'price-trend' }));
  });

  it('filters price trend evidence by the saved buyer budget before presenting it', async () => {
    const sampleLots = resolveBuyerFixtureLots().filter((lot) => lot.status === 'sold').slice(0, 2);
    const overBudget = { ...sampleLots[0]!, id: 'over-budget', realizedPrice: { amount: 260, currency: 'USD' as const } };
    const inBudget = { ...sampleLots[1]!, id: 'in-budget', realizedPrice: { amount: 240, currency: 'USD' as const } };
    const lotsResolver = { findLot: jest.fn(async (id: string) => ({ 'over-budget': overBudget, 'in-budget': inBudget }[id] ?? null)) };
    const criteria = { getCriteriaForSession: jest.fn(() => ({ categories: ['rare_books'], price: { max: 250, currency: 'USD' } })) };
    const presentation: BuyerResultsPresentationPort = {
      presentSearchResults: jest.fn(),
      presentPriceTrend: jest.fn(async () => ({ lots: [inBudget], points: [] })),
    };
    const executor = new BuyerP4FunctionExecutor(
      createSaleHistory(), presentation, criteria as unknown as BuyerCriteriaService, lotsResolver as unknown as BuyerLotsResolverService,
    );
    const updates: import('./buyer-chat-update').BuyerChatUpdate[] = [];

    await executor.execute({
      extract: { provider: 'fixture', mode: 'fixture', content: '', summary: '', recommendation: '', nextAction: '', confidence: 'low' },
      readyForFunction: true,
      intentRoute: { functionName: SHILAT_FUNCTION_PRICE_TREND, readyForFunction: true },
      functionParameters: null,
    }, { sessionId: 's1', language: 'en', criteriaComplete: false, p4Context: { lots: [{ id: 'over-budget' }, { id: 'in-budget' }] } }, updates);

    expect(presentation.presentPriceTrend).toHaveBeenCalledWith(expect.objectContaining({ lots: [{ id: 'in-budget' }] }));
  });

  describe('similar items in other categories', () => {
    const similarLot = findBuyerFixtureLot('lot-history-sold-001');

    // P4 reply for the follow-up question: similar-lots intent with no function name.
    const similarAi: P4AiGenerateResponse = {
      extract,
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
      const sessionSearch = new BuyerSessionSearchService(
        {} as BuyerResultsPresentationPort,
        new FixtureLotsSearchClient(),
      );
      const searchOtherCategories = jest.spyOn(sessionSearch, 'searchOtherCategoriesForSession');
      const searchForSession = jest.spyOn(sessionSearch, 'searchForSession');
      const executor = new BuyerP4FunctionExecutor(
        {} as BuyerComparableSaleHistoryService,
        {} as BuyerResultsPresentationPort,
        new BuyerCriteriaService(),
        createLotsResolver(),
        undefined,
        undefined,
        sessionSearch,
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
