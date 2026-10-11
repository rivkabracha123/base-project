import { Injectable } from '@nestjs/common';
import {
  SHILAT_FUNCTION_GET_LOT_BY_ID,
  resolveBuyerActionFromP4,
  shouldRunComparableSaleHistory,
} from '../ai/p4-buyer-routing';
import type { P4AiGenerateResponse, P4BuyerAiContext } from '../ai/p4-ai.types';
import type { BuyerChatUpdate } from './buyer-chat-update';
import { BuyerComparableSaleHistoryService } from './buyer-comparable-sale-history.service';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerLotsResolverService } from './buyer-lots-resolver.service';
import { BuyerSessionSearchService } from './buyer-session-search.service';

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
    private readonly sessionSearch: BuyerSessionSearchService,
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
      updates.push({
        speaker: 'error',
        code: 'similar_not_wired',
        text:
          ctx.language === 'he'
            ? 'חיפוש פריטים דומים עדיין לא מחובר — B3/B4.'
            : 'Similar items search is not wired yet (B3/B4).',
      });
      return true;
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

    const search = await this.sessionSearch.searchForSession(ctx.sessionId);
    if (search.kind === 'insufficient-criteria') {
      updates.push({ speaker: 'system', text: search.message });
      return true;
    }
    if (search.kind === 'unmatched') {
      updates.push({ speaker: 'no-results', text: search.message });
      return true;
    }

    const totalLots = search.groups.reduce((count, group) => count + group.lots.length, 0);
    updates.push({
      speaker: 'results-found',
      text:
        ctx.language === 'he'
          ? `מצאנו ${totalLots} פריטים שמתאימים לבקשה.`
          : `Found ${totalLots} lots that match this request.`,
    });

    for (const group of search.groups) {
      if (group.lots.length === 0) continue;
      updates.push({ speaker: 'result-group', title: group.title, lots: group.lots });
    }
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
