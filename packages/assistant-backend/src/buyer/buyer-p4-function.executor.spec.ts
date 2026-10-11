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
    expect(updates.some((u) => u.speaker === 'result-group')).toBe(true);
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
