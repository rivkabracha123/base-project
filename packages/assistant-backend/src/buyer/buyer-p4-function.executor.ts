import { Inject, Injectable, Optional } from '@nestjs/common';
import { SellerLeadsService } from '../seller-leads/seller-leads.service';
import { ComparablesService } from '../comparables/comparables.service';
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
import type { AuctionLot, BuyerPriceRange } from '@monabid/shared';

export type P4FunctionExecutionContext = {
  sessionId: string;
  language: 'he' | 'en';
  p4Context?: P4BuyerAiContext;
  /** B2 criteria + conversation have no missing search facts. */
  criteriaComplete: boolean;
};

function lotMatchesPrice(lot: AuctionLot, price: BuyerPriceRange | undefined): boolean {
  if (!price || (price.min == null && price.max == null)) return true;

  if (lot.realizedPrice) {
    const amount = lot.realizedPrice.amount;
    return (price.min == null || amount >= price.min) && (price.max == null || amount <= price.max);
  }

  if (lot.estimate) {
    return (price.min == null || lot.estimate.high.amount >= price.min) && (price.max == null || lot.estimate.low.amount <= price.max);
  }

  return false;
}

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
    @Optional() private readonly sellerLeads?: SellerLeadsService,
    @Optional() private readonly comparables?: ComparablesService,
  ) {}

  /** Run the function Shilat named, push chat updates. Returns true if a handler ran. */
  async execute(
    ai: P4AiGenerateResponse,
    ctx: P4FunctionExecutionContext,
    updates: BuyerChatUpdate[],
  ): Promise<boolean> {
    const action = resolveBuyerActionFromP4(ai);
    const routeName = ai.intentRoute.functionName;
    if (routeName === 'rankSellerHouses') {
      if (!ai.intentRoute.readyForFunction) return false;
      if (!this.sellerLeads) throw new Error('Buyer auction-house service is unavailable');
      const args = ai.intentRoute.arguments ?? ai.functionParameters ?? {};
      const category = typeof args.category === 'string' ? args.category.trim() : '';
      if (!category || ['unknown', 'general'].includes(category)) return false;
      const ranking = this.sellerLeads.rankHouses({ category, preferredLanguage: ctx.language,
        ...(typeof args.geography === 'string' && args.geography.trim() ? { geography: args.geography.trim() } : {}) });
      const houses = [ranking.recommendation, ...ranking.alternatives].filter((entry) => entry?.house.active && entry.house.categories.includes(category));
      if (houses.length) {
        updates.push({ speaker: 'house-ranking', category, ranking: {
          ...ranking, recommendation: houses[0]!, alternatives: houses.slice(1).map(entry => entry!),
        } });
        return true;
      }
      updates.push({ speaker: 'system', text: houses.length
        ? `${ctx.language === 'he' ? '\u05d1\u05ea\u05d9 \u05de\u05db\u05d9\u05e8\u05d5\u05ea \u05de\u05ea\u05de\u05d7\u05d9\u05dd' : 'Specialist auction houses'}: ${houses.map((entry) => entry!.house.name).join(', ')}`
        : ctx.language === 'he' ? '\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d5 \u05d1\u05ea\u05d9 \u05de\u05db\u05d9\u05e8\u05d5\u05ea \u05de\u05ea\u05de\u05d7\u05d9\u05dd \u05d1\u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d4 \u05d4\u05d6\u05d0\u05ea.' : 'No specialist auction houses were found for this category.' });
      return true;
    }
    if (ai.intentRoute.intent === 'search_similar_lots') {
      if (!ai.intentRoute.readyForFunction) return false;
      if (!this.comparables) throw new Error('Buyer comparison service is unavailable');
      const args = ai.intentRoute.arguments ?? {};
      const selected = ctx.p4Context?.selectedLot ?? args.selectedLot as { id?: string } | undefined;
      const anchor = typeof selected?.id === 'string' ? await this.lotsResolver.findLot(selected.id) : null;
      if (selected?.id && !anchor) {
        updates.push({ speaker: 'error', code: 'similar_lot_not_found', text: ctx.language === 'he' ? '\u05d4\u05e4\u05e8\u05d9\u05d8 \u05e9\u05e0\u05d1\u05d7\u05e8 \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0.' : 'The selected item was not found.' });
        return true;
      }
      const category = typeof args.category === 'string' && args.category.trim() ? args.category.trim()
        : anchor?.category ?? this.criteriaService.getCriteriaForSession(ctx.sessionId).categories.map((value) => value.trim()).filter(Boolean).at(-1);
      if (!category || ['unknown', 'general'].includes(category)) return false;
      const criteria = this.criteriaService.getCriteriaForSession(ctx.sessionId);
      const evidence = await this.comparables.findComparables({ category });
      const status = args.status === 'sold' ? 'sold' : 'upcoming';
      const lots = [...evidence.included, ...evidence.excluded]
        .filter((entry) => entry.lot.status === status && entry.lot.category === category && entry.score >= 0.8 && entry.lot.id !== anchor?.id)
        .filter((entry) => lotMatchesPrice(entry.lot, criteria.price))
        .map((entry) => entry.lot);
      updates.push(lots.length ? { speaker: 'result-group', title: ctx.language === 'he' ? '\u05e4\u05e8\u05d9\u05d8\u05d9\u05dd \u05d3\u05d5\u05de\u05d9\u05dd \u05dc\u05e4\u05d9 \u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d4' : 'Similar items by category', lots }
        : { speaker: 'no-results', text: ctx.language === 'he' ? '\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d5 \u05e4\u05e8\u05d9\u05d8\u05d9\u05dd \u05d3\u05d5\u05de\u05d9\u05dd.' : 'No similar items were found.' });
      return true;
    }

    if (action.kind === 'priceTrend' || routeName === SHILAT_FUNCTION_PRICE_TREND) {
      if (!ai.intentRoute.readyForFunction) return false;
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
        updates.push({ speaker: 'sale-history', title: result.title, lots: result.sales });
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
    const criteria = this.criteriaService.getCriteriaForSession(ctx.sessionId);
    if (!criteria.categories.length) {
      updates.push({ speaker: 'system', text: ctx.language === 'he' ? '\u05d0\u05d9\u05dc\u05d5 \u05e4\u05e8\u05d9\u05d8\u05d9\u05dd \u05dc\u05d7\u05e4\u05e9?' : 'What items would you like to search for?' });
      return true;
    }
    const result = await this.resultsPresentation.presentSearchResults({
      searchContextId: ctx.sessionId,
      criteria,
      selectedLotId: ctx.p4Context?.selectedLot?.id,
      onUpdate: (flowUpdate) => {
        updates.push(...buyerFlowUpdatesToChatUpdates(flowUpdate, ctx.language));
      },
    });
    if (result?.outcome.kind === 'results') {
      const evidenceLotIds = result.outcome.results.historical.filter(entry => entry.lot.status === 'sold').map(entry => entry.lot.id);
      for (const update of updates) {
        if (update.speaker === 'result-group') update.evidenceLotIds = evidenceLotIds;
      }
    }
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

    const criteria = this.criteriaService.getCriteriaForSession(ctx.sessionId);
    const trendLots = criteria.price
      ? (await Promise.all(lots.map(async (lot) => {
          const resolved = await this.lotsResolver.findLot(lot.id);
          return resolved && lotMatchesPrice(resolved, criteria.price) ? { id: lot.id } : null;
        }))).filter((lot): lot is { id: string } => lot !== null)
      : lots;
    if (!trendLots.length) {
      updates.push({
        speaker: 'no-results',
        text: ctx.language === 'he'
          ? 'לא נמצאו פריטים בתקציב להצגת מגמת מחירים.'
          : 'No in-budget lots were found for a price trend.',
      });
      return true;
    }

    if (!this.resultsPresentation.presentPriceTrend) {
      updates.push({ speaker: 'error', code: 'price_trend_unavailable', text: 'Price trend is unavailable.' });
      return true;
    }

    await this.resultsPresentation.presentPriceTrend({
      lots: trendLots,
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
