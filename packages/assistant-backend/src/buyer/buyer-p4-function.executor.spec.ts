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
