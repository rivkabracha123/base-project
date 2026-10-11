import type { P4AiGenerateResponse } from '../ai/p4-ai.types';
import { SHILAT_FUNCTION_COMPARABLE_SALE_HISTORY } from '../ai/p4-buyer-routing';
import type { BuyerLotsResolverService } from './buyer-lots-resolver.service';
import { BuyerComparableSaleHistoryService } from './buyer-comparable-sale-history.service';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerP4FunctionExecutor } from './buyer-p4-function.executor';
import { BuyerSessionSearchService } from './buyer-session-search.service';
import { FixtureLotsSearchClient } from './fixture-lots-search.client';
import { findBuyerFixtureLot, resolveBuyerFixtureLots } from './fixture-lots.pool';

describe('BuyerP4FunctionExecutor', () => {
  const extract: P4AiGenerateResponse['extract'] = {
    provider: 'fixture', mode: 'fixture', content: '', summary: '',
    recommendation: '', nextAction: '', confidence: 'low',
  };
  it('asks for criteria instead of reporting no results when a search cannot run', async () => {
    const executor = new BuyerP4FunctionExecutor(
      {} as BuyerComparableSaleHistoryService,
      { searchForSession: jest.fn(async () => ({ kind: 'insufficient-criteria', message: 'What items?' })) } as unknown as BuyerSessionSearchService,
      { getCriteriaReview: () => ({ summary: 'Review' }) } as unknown as BuyerCriteriaService,
      {} as BuyerLotsResolverService,
    );
    const updates: import('./buyer-chat-update').BuyerChatUpdate[] = [];
    const ai: P4AiGenerateResponse = { extract, readyForFunction: true, functionParameters: null,
      intentRoute: { functionName: 'searchLots', readyForFunction: true, missingFields: [] } };
    await executor.execute(ai, { sessionId: 's1', language: 'en', criteriaComplete: true }, updates);
    expect(updates).toContainEqual({ speaker: 'system', text: 'What items?' });
    expect(updates.some(update => update.speaker === 'no-results' || update.speaker === 'results-found')).toBe(false);
  });
  it('does not execute search when P4 blocks it, even with complete B2 criteria', async () => {
    const search = { searchForSession: jest.fn() };
    const executor = new BuyerP4FunctionExecutor(
      {} as BuyerComparableSaleHistoryService,
      search as unknown as BuyerSessionSearchService,
      new BuyerCriteriaService(),
      {} as BuyerLotsResolverService,
    );
    const ai = {
      extract, readyForFunction: false, functionParameters: null,
      intentRoute: { intent: 'search_auction_lots', functionName: 'searchLots', readyForFunction: false, missingFields: ['category'] },
    } as P4AiGenerateResponse;
    expect(await executor.execute(ai, { sessionId: 's1', language: 'he', criteriaComplete: true }, [])).toBe(false);
    expect(search.searchForSession).not.toHaveBeenCalled();
  });
  it('reads the id argument emitted by the P4 details router without extra context', async () => {
    const lot = findBuyerFixtureLot('lot-history-upcoming-001');
    const resolver = { findLot: jest.fn(async () => lot) };
    const executor = new BuyerP4FunctionExecutor(
      {} as BuyerComparableSaleHistoryService, {} as BuyerSessionSearchService,
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
});
