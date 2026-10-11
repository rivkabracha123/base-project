import type { AiExtractResponse } from '../buyer/buyer-criteria';
import type { SellerHandoffContract } from './seller-handoff';
import type { AiFunctionCall } from './ai.dto';

/** Body Shilat expects on POST /ai/generate (same shape B2 forwards in real mode). */
export type ShilatAiGenerateRequest = {
  prompt: string;
  language: 'he' | 'en';
  sessionId?: string;
  selectedLot?: { id: string } | null;
  lots?: { id: string }[];
};

export type ShilatSellerGenerateResponse = {
  provider: 'fixture' | 'real';
  mode: 'fixture' | 'real';
  isRelevant: boolean;
  error: string | null;
  content: string;
  summary: string;
  recommendation: string;
  nextAction: string;
  confidence: 'low' | 'medium';
  structuredAnswer: SellerHandoffContract;
  functionCall?: AiFunctionCall | null;
};

/** @deprecated alias — use ShilatAiGenerateRequest */
export type P4AiGenerateRequest = ShilatAiGenerateRequest;

/** Safe buyer context from Tamar — flattened into ShilatAiGenerateRequest. */
export type P4BuyerAiContext = {
  sessionId?: string;
  selectedLot?: { id: string } | null;
  lots?: { id: string }[];
};

/** Matches Shilat intentRoute (+ B2 alias searchLots when execution is allowed). */
export type P4IntentRoute = {
  intent?: string | null;
  functionName: string | null;
  readyForFunction: boolean;
  missingFields?: string[];
  arguments?: Record<string, unknown>;
};

/** Normalized P4 reply — routing + extract for B2 criteria and search. */
export type P4AiGenerateResponse = {
  extract: AiExtractResponse;
  readyForFunction: boolean;
  intentRoute: P4IntentRoute;
  /** Optional payload from Shilat describing what to pass into the routed function. */
  functionParameters: Record<string, unknown> | null;
};

/** Internal message — fixture P4 treats this as readyForFunction for searchLots. */
export const P4_SEARCH_READINESS_PROBE_MESSAGE =
  'Buyer criteria are complete. Evaluate readiness for search.';

/** Registered buyer functions P4 may route — execution stays on B2/B3 HTTP. */
export const P4_BUYER_FUNCTION_ROUTES = {
  searchLots: {
    functionName: 'searchLots',
    httpMethod: 'POST' as const,
    pathTemplate: '/buyer/sessions/:sessionId/search',
  },
  /** Shilat intent-router name — B2 implements in BuyerP4FunctionExecutor. */
  getComparableSaleHistory: {
    functionName: 'getComparableSaleHistory',
    httpMethod: 'POST' as const,
    pathTemplate: '/buyer/comparable-sale-history',
  },
  getLotById: {
    functionName: 'getLotById',
    httpMethod: 'GET' as const,
    pathTemplate: '/lots/:id',
  },
} as const;

export function mergeBuyerContextIntoShilatRequest(
  prompt: string,
  language: 'he' | 'en',
  context?: P4BuyerAiContext,
): ShilatAiGenerateRequest {
  return {
    prompt,
    language,
    ...(context?.sessionId ? { sessionId: context.sessionId } : {}),
    selectedLot: context?.selectedLot ?? null,
    ...(context?.lots?.length ? { lots: context.lots } : {}),
  };
}
