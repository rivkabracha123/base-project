import type { P4AiGenerateResponse } from '../ai/p4-ai.types';
import {
  SHILAT_FUNCTION_COMPARABLE_SALE_HISTORY,
  SHILAT_FUNCTION_GET_LOT_BY_ID,
  SHILAT_FUNCTION_PRICE_TREND,
} from '../ai/p4-buyer-routing';
import type { BuyerLotsResolverService } from './buyer-lots-resolver.service';
import type { LotsService } from '../lots/lots.service';
import { BuyerComparableSaleHistoryService } from './buyer-comparable-sale-history.service';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerP4FunctionExecutor } from './buyer-p4-function.executor';
import { BuyerSearchExecutionService } from './buyer-search-execution.service';
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
      createSaleHistory(), presentation, new BuyerCriteriaService(), lotsResolver,
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
});
