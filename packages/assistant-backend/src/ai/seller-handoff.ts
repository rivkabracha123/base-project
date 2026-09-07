// Define and validate the seller handoff contract
export type SellerHandoffContract = {
  role: 'seller';
  language: 'he' | 'en';
  intent: string;
  category: string;
  item: {
    title?: string;
    dimensions?: string;
    condition?: string;
    markings?: string;
    signature?: string;
    provenance?: string;
    notes?: string[];
  };
  missingFacts: string[];
  hasContactDetails: boolean;
  hasImages: boolean;
};

export function isSellerHandoffContract(value: unknown): value is SellerHandoffContract {
  if (!value || typeof value !== 'object') return false;

  const handoff = value as Record<string, unknown>;
  const item = handoff.item;
  if (!item || typeof item !== 'object') return false;

  return (
    handoff.role === 'seller' &&
    (handoff.language === 'he' || handoff.language === 'en') &&
    typeof handoff.intent === 'string' && handoff.intent.trim().length > 0 &&
    typeof handoff.category === 'string' && handoff.category.trim().length > 0 &&
    Array.isArray(handoff.missingFacts) && handoff.missingFacts.every((fact) => typeof fact === 'string') &&
    typeof handoff.hasContactDetails === 'boolean' &&
    typeof handoff.hasImages === 'boolean'
  );
}