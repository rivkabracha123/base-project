import type { SellerItemDraft } from '@monabid/shared';
import type { MissingSellerQuestion } from './seller-intake.service';

export const SELLER_INTAKE_AI_PROVIDER = Symbol('SELLER_INTAKE_AI_PROVIDER');

// Owned by S1: draft, missing fields, next question and seller confirmations.
export type SellerIntakeResult = SellerItemDraft & {
  provider: 'fixture-mock';
  missingFields: string[];
  nextQuestion: MissingSellerQuestion | null;
  sessionId?: string;
  answerAccepted?: boolean;
  answerError?: string;
};

// Owned by P4: AI enrichment/validation only. Never overrides draft fields.
export type SellerIntakeAiEnrichment = {
  provider: 'fixture' | 'real' | null;
  mode: 'fixture' | 'real' | null;
  fallbackMode?: 'guided';
  isRelevant: boolean;
  error: string | null;
  aiMissingFields: string[];
};

export type SellerIntakeAiResult = SellerIntakeResult & {
  structuredAnswer: unknown | null;
  ai: SellerIntakeAiEnrichment;
};

export interface SellerIntakeAiProvider {
  analyze(input: string, sessionId?: string): Promise<SellerIntakeAiResult> | SellerIntakeAiResult;
}
