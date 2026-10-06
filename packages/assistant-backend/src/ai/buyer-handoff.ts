// Define and validate the buyer handoff contract
export type BuyerHandoffContract = {
  language: 'he' | 'en';
  intent: string;
  category: string;
  missingFacts: string[];
  hasContactDetails: boolean;
  hasImages: boolean;
};

export function isBuyerHandoffContract(value: unknown): value is BuyerHandoffContract {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const handoff = value as Record<string, unknown>;

  return (
    (handoff.language === 'he' || handoff.language === 'en') &&
    typeof handoff.intent === 'string' &&
    handoff.intent.trim().length > 0 &&
    typeof handoff.category === 'string' &&
    handoff.category.trim().length > 0 &&
    Array.isArray(handoff.missingFacts) &&
    handoff.missingFacts.every((fact) => typeof fact === 'string') &&
    typeof handoff.hasContactDetails === 'boolean' &&
    typeof handoff.hasImages === 'boolean'
  );
}