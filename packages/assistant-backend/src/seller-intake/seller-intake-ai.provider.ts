import type { SellerItemDraft } from '@monabid/shared';
import type { AiFunctionCall } from '../ai/ai.dto';
import type { SellerHandoffContract } from '../ai/seller-handoff';
import type { MissingSellerQuestion } from './seller-intake.service';

export const SELLER_INTAKE_AI_PROVIDER = Symbol('SELLER_INTAKE_AI_PROVIDER');

// Owned by S1: draft, missing fields, next question and seller confirmations.
export type SellerIntakeResult = SellerItemDraft & {
  provider: 'fixture-mock';
  missingFields: string[];
  requiredMissingFields?: string[];
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
  // AI-suggested missing facts mapped to intake names (markings -> marks, signature -> signatures).
  aiMissingFields: string[];
  summary?: string;
  nextAction?: string;
};

export type SellerIntakeAiResult = SellerIntakeResult & {
  // null only when the AI service itself failed; the intake result stays valid.
  structuredAnswer: SellerHandoffContract | null;
  functionCall?: AiFunctionCall | null;
  ai: SellerIntakeAiEnrichment;
};

export interface SellerIntakeAiProvider {
  hasSession?(sessionId: string): boolean;
  restoreSession?(sessionId: string, draft: SellerItemDraft): void;
  analyze(input: string, sessionId?: string): Promise<SellerIntakeAiResult> | SellerIntakeAiResult;
}
