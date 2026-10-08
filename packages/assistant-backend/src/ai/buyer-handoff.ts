import { isCompletionState, type CompletionState } from './completion-state';

// Define and validate the buyer handoff contract
export type BuyerExtraction = {
  role: 'buyer';
  language: 'he' | 'en';
  intent: string;
  category?: string;
  creators?: string[];
  periods?: string[];
  price?: { min?: number; max?: number; currency?: string };
  keywords?: string[];
  geography?: string[];
  hasContactDetails: boolean;
  hasImages: boolean;
  completionState?: CompletionState;
};

export type BuyerHandoffContract = BuyerExtraction;

export function isBuyerHandoffContract(value: unknown): value is BuyerHandoffContract {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const handoff = value as Record<string, unknown>;

  return (
    handoff.role === 'buyer' &&
    (handoff.language === 'he' || handoff.language === 'en') &&
    typeof handoff.intent === 'string' &&
    handoff.intent.trim().length > 0 &&
    (handoff.category === undefined || (typeof handoff.category === 'string' && handoff.category.trim().length > 0)) &&
    (handoff.creators === undefined || (Array.isArray(handoff.creators) && handoff.creators.every((creator) => typeof creator === 'string'))) &&
    (handoff.periods === undefined || (Array.isArray(handoff.periods) && handoff.periods.every((period) => typeof period === 'string'))) &&
    (handoff.price === undefined || isValidPrice(handoff.price)) &&
    (handoff.keywords === undefined || (Array.isArray(handoff.keywords) && handoff.keywords.every((keyword) => typeof keyword === 'string'))) &&
    (handoff.geography === undefined || (Array.isArray(handoff.geography) && handoff.geography.every((place) => typeof place === 'string'))) &&
    typeof handoff.hasContactDetails === 'boolean' &&
    typeof handoff.hasImages === 'boolean' &&
    (handoff.completionState === undefined || isCompletionState(handoff.completionState))
  );
}

function isValidPrice(value: unknown): value is BuyerExtraction['price'] {
  if (!value || typeof value !== 'object') return false;

  const price = value as Record<string, unknown>;
  return (
    (price.min === undefined || typeof price.min === 'number') &&
    (price.max === undefined || typeof price.max === 'number') &&
    (price.currency === undefined || typeof price.currency === 'string')
  );
}