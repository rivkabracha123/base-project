import { Inject, Injectable } from '@nestjs/common';
import {
  SHILAT_FUNCTION_GET_LOT_BY_ID,
  SHILAT_FUNCTION_PRICE_TREND,
  resolveBuyerActionFromP4,
  shouldRunComparableSaleHistory,
} from '../ai/p4-buyer-routing';
import type { P4AiGenerateResponse, P4BuyerAiContext } from '../ai/p4-ai.types';
import type { BuyerChatUpdate } from './buyer-chat-update';
import { buyerFlowUpdatesToChatUpdates } from './buyer-flow-update-mapper';
import {
  BUYER_RESULTS_PRESENTATION_PORT,
  type BuyerResultsPresentationPort,
} from './buyer-results-presentation.port';
import { BuyerComparableSaleHistoryService } from './buyer-comparable-sale-history.service';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerLotsResolverService } from './buyer-lots-resolver.service';

export type P4FunctionExecutionContext = {
  sessionId: string;
  language: 'he' | 'en';
  p4Context?: P4BuyerAiContext;
  /** B2 criteria + conversation have no missing search facts. */
  criteriaComplete: boolean;
};

/**
 * Maps Shilat intentRoute.functionName → B2 handlers (search, sale history, lot detail).
 */
@Injectable()
export class BuyerP4FunctionExecutor {
  constructor(
    private readonly saleHistory: BuyerComparableSaleHistoryService,
    @Inject(BUYER_RESULTS_PRESENTATION_PORT)
    private readonly resultsPresentation: BuyerResultsPresentationPort,
    private readonly criteriaService: BuyerCriteriaService,
    private readonly lotsResolver: BuyerLotsResolverService,
  ) {}

  /** Run the function Shilat named, push chat updates. Returns true if a handler ran. */
  async execute(
    ai: P4AiGenerateResponse,
    ctx: P4FunctionExecutionContext,
    updates: BuyerChatUpdate[],
  ): Promise<boolean> {
    const action = resolveBuyerActionFromP4(ai);
    const routeName = ai.intentRoute.functionName;

    if (action.kind === 'priceTrend' || routeName === SHILAT_FUNCTION_PRICE_TREND) {
      return this.runPriceTrend(ctx, updates);
    }

    if (action.kind === 'getComparableSaleHistory' || shouldRunComparableSaleHistory(ai, ctx.p4Context)) {
      return await this.runComparableSaleHistory(ai, ctx, updates);
    }

    if (action.kind === 'getLotById' || routeName === SHILAT_FUNCTION_GET_LOT_BY_ID) {
      return await this.runGetLotById(ai, ctx, updates);
    }

    if (action.kind === 'searchLots') {
      if (!ctx.criteriaComplete) {
        return false;
      }
      return this.runSearchLots(ctx, updates);
    }

    if (action.kind === 'similarLots') {
      if (!ctx.criteriaComplete) {
        return false;
      }
      return this.runSearchLots(ctx, updates);
    }

    return false;
  }

  private async runComparableSaleHistory(
    ai: P4AiGenerateResponse,
    ctx: P4FunctionExecutionContext,
    updates: BuyerChatUpdate[],
  ): Promise<boolean> {
    const request = this.saleHistory.resolveFromP4Context(
      ai.intentRoute.arguments ?? ai.functionParameters ?? undefined,
      ctx.p4Context,
      ctx.language,
    );
    if (!request) {
      updates.push({
        speaker: 'error',
        code: 'sale_history_missing_lot',
        text:
          ctx.language === 'he'
            ? 'כדי להציג היסטוריית מכירות צריך לבחור פריט (selectedLot).'
            : 'Select a lot (selectedLot) to show sale history.',
      });
      return true;
    }

    try {
      const result = await this.saleHistory.getHistory(request);
      updates.push({ speaker: 'system', text: result.summary });
      if (result.sales.length > 0) {
        updates.push({ speaker: 'result-group', title: result.title, lots: result.sales });
      }
    } catch {
      updates.push({
        speaker: 'error',
        code: 'sale_history_failed',
        text:
          ctx.language === 'he'
            ? 'לא הצלחנו לטעון היסטוריית מכירות לפריט הזה.'
            : 'Could not load sale history for this lot.',
      });
    }
    return true;
  }

  private async runGetLotById(
    ai: P4AiGenerateResponse,
    ctx: P4FunctionExecutionContext,
    updates: BuyerChatUpdate[],
  ): Promise<boolean> {
    if (!ai.intentRoute.readyForFunction) {
      return false;
    }

    const lotId =
      readLotIdFromArguments(ai.intentRoute.arguments) ??
      ctx.p4Context?.selectedLot?.id;
    if (!lotId) {
      return false;
    }

    const lot = await this.lotsResolver.findLot(lotId);
    if (!lot) {
      updates.push({
        speaker: 'error',
        code: 'lot_not_found',
        text: ctx.language === 'he' ? 'הפריט לא נמצא.' : 'Lot not found.',
      });
      return true;
    }

    const title = ctx.language === 'he' ? 'פרטי הפריט' : 'Item details';
    updates.push({ speaker: 'result-group', title, lots: [lot] });
    return true;
  }

  private async runSearchLots(ctx: P4FunctionExecutionContext, updates: BuyerChatUpdate[]): Promise<boolean> {
    const review = this.criteriaService.getCriteriaReview(ctx.sessionId);
    updates.push({ speaker: 'system', text: review.summary });

    const criteria = this.criteriaService.getCriteriaForSession(ctx.sessionId);
    if (!criteria.categories.length) {
      updates.push({ speaker: 'system', text: ctx.language === 'he' ? '\u05d0\u05d9\u05dc\u05d5 \u05e4\u05e8\u05d9\u05d8\u05d9\u05dd \u05dc\u05d7\u05e4\u05e9?' : 'What items would you like to search for?' });
      return true;
    }
    await this.resultsPresentation.presentSearchResults({
      searchContextId: ctx.sessionId,
      criteria,
      selectedLotId: ctx.p4Context?.selectedLot?.id,
      onUpdate: (flowUpdate) => {
        updates.push(...buyerFlowUpdatesToChatUpdates(flowUpdate, ctx.language));
      },
    });
    return true;
  }

  private async runPriceTrend(ctx: P4FunctionExecutionContext, updates: BuyerChatUpdate[]): Promise<boolean> {
    const lots = ctx.p4Context?.lots;
    if (!lots?.length) {
      updates.push({
        speaker: 'error',
        code: 'price_trend_missing_results',
        text: ctx.language === 'he'
          ? 'כדי להציג מגמת מחירים צריך לבצע קודם חיפוש של פריטים.'
          : 'Search for lots first to show a price trend.',
      });
      return true;
    }

    if (!this.resultsPresentation.presentPriceTrend) {
      updates.push({ speaker: 'error', code: 'price_trend_unavailable', text: 'Price trend is unavailable.' });
      return true;
    }

    await this.resultsPresentation.presentPriceTrend({
      lots,
      language: ctx.language,
      onUpdate: (flowUpdate) => {
        updates.push(...buyerFlowUpdatesToChatUpdates(flowUpdate, ctx.language));
      },
    });
    return true;
  }
}

function readLotIdFromArguments(args: Record<string, unknown> | undefined): string | null {
  if (!args) return null;
  if (typeof args.id === 'string' && args.id.trim()) return args.id.trim();
  if (typeof args.lotId === 'string') return args.lotId;
  if (args.selectedLot && typeof args.selectedLot === 'object') {
    const id = (args.selectedLot as { id?: string }).id;
    if (typeof id === 'string') return id;
  }
  return null;
}
