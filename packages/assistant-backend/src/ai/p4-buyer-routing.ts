import type { AiExtractResponse } from '../buyer/buyer-criteria';
import type { P4AiGenerateResponse, P4IntentRoute, P4BuyerAiContext } from './p4-ai.types';

/** Shilat intent-router names (see P4 intent-router.ts). */
export const SHILAT_INTENT_SEARCH_AUCTION_LOTS = 'search_auction_lots';
export const SHILAT_INTENT_SEARCH_SIMILAR_LOTS = 'search_similar_lots';
export const SHILAT_INTENT_SAME_ITEM_SALE_HISTORY = 'same_item_sale_history';

export const SHILAT_FUNCTION_COMPARABLE_SALE_HISTORY = 'getComparableSaleHistory';
export const SHILAT_FUNCTION_GET_LOT_BY_ID = 'getLotById';

/** P4 registry gaps — B2 may still run search when only these are missing. */
export const SHILAT_MISSING_SEARCH_FUNCTION = 'searchAuctionLotsFunction';
export const SHILAT_MISSING_SIMILAR_FUNCTION = 'similarLotsFunction';

/** B2 execution name (until Shilat adds this to IntentRoute.functionName). */
export const B2_SEARCH_LOTS_FUNCTION = 'searchLots';

export type ResolvedBuyerAction =
  | { kind: 'searchLots' }
  | { kind: 'similarLots' }
  | { kind: 'getComparableSaleHistory' }
  | { kind: 'getLotById' }
  | { kind: 'none' };

function structuredReadyForFunctions(extract: AiExtractResponse): boolean {
  const structured = extract.structuredAnswer as Record<string, unknown> | undefined;
  if (!structured?.completionState || typeof structured.completionState !== 'object') {
    return false;
  }
  const completionState = structured.completionState as Record<string, unknown>;
  return completionState.readyForFunctions === true;
}

function onlyP4RegistryMissing(missingFields: string[] | undefined, allowed: string[]): boolean {
  if (!missingFields?.length) {
    return false;
  }
  return missingFields.every((field) => allowed.includes(field));
}

/** Whether B2 may run POST .../search after criteria are complete. */
export function p4AllowsBuyerLotSearch(ai: P4AiGenerateResponse): boolean {
  const route = ai.intentRoute;

  if (route.functionName === B2_SEARCH_LOTS_FUNCTION && route.readyForFunction) {
    return true;
  }

  if (route.intent !== SHILAT_INTENT_SEARCH_AUCTION_LOTS) {
    return false;
  }

  if (route.readyForFunction) {
    return true;
  }

  if (structuredReadyForFunctions(ai.extract)) {
    return true;
  }

  return onlyP4RegistryMissing(route.missingFields, [SHILAT_MISSING_SEARCH_FUNCTION]);
}

export function resolveBuyerActionFromP4(ai: P4AiGenerateResponse): ResolvedBuyerAction {
  const route = ai.intentRoute;

  if (route.functionName === SHILAT_FUNCTION_COMPARABLE_SALE_HISTORY && route.readyForFunction) {
    return { kind: 'getComparableSaleHistory' };
  }
  if (route.functionName === SHILAT_FUNCTION_GET_LOT_BY_ID && route.readyForFunction) {
    return { kind: 'getLotById' };
  }

  if (p4AllowsBuyerLotSearch(ai)) {
    return { kind: 'searchLots' };
  }

  if (route.intent === SHILAT_INTENT_SEARCH_SIMILAR_LOTS) {
    return { kind: 'similarLots' };
  }

  return { kind: 'none' };
}

/** P4 ready, or same-item intent with lot context from Tamar (Shilat DTO gap). */
export function shouldRunComparableSaleHistory(
  ai: P4AiGenerateResponse,
  context?: P4BuyerAiContext,
): boolean {
  if (resolveBuyerActionFromP4(ai).kind === 'getComparableSaleHistory') {
    return true;
  }
  return ai.intentRoute.intent === SHILAT_INTENT_SAME_ITEM_SALE_HISTORY && Boolean(context?.selectedLot?.id);
}

export function toSearchReadinessRoute(ai: P4AiGenerateResponse): P4IntentRoute {
  const action = resolveBuyerActionFromP4(ai);
  if (action.kind === 'searchLots') {
    return {
      ...ai.intentRoute,
      functionName: B2_SEARCH_LOTS_FUNCTION,
      readyForFunction: true,
    };
  }
  if (action.kind === 'getComparableSaleHistory') {
    return { ...ai.intentRoute, functionName: 'getComparableSaleHistory', readyForFunction: true };
  }
  if (action.kind === 'getLotById') {
    return { ...ai.intentRoute, functionName: 'getLotById', readyForFunction: true };
  }
  return ai.intentRoute;
}
