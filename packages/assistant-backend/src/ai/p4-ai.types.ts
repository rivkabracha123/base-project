import type { AiExtractResponse } from '../buyer/buyer-criteria';

/** Safe buyer context for P4 — no contact details or raw images. */
export type P4BuyerAiContext = {
  sessionId?: string;
  selectedLot?: { id: string } | null;
  lots?: { id: string }[];
};

/** Request body forwarded to Shilat POST /ai/generate (same shape on both services). */
export type P4AiGenerateRequest = {
  role: 'buyer';
  userMessage: string;
  language: 'he' | 'en';
  context?: P4BuyerAiContext;
};

export type P4IntentRoute = {
  functionName: string | null;
  readyForFunction: boolean;
};

/** Response from P4 — extract is always validated before B2 uses it. */
export type P4AiGenerateResponse = {
  extract: AiExtractResponse;
  readyForFunction: boolean;
  intentRoute: P4IntentRoute;
};

/** Registered buyer functions P4 may route — execution stays on B2/B3 HTTP. */
export const P4_BUYER_FUNCTION_ROUTES = {
  searchLots: {
    functionName: 'searchLots',
    httpMethod: 'POST' as const,
    /** Relative to global prefix `api`. */
    pathTemplate: '/buyer/sessions/:sessionId/search',
  },
} as const;
