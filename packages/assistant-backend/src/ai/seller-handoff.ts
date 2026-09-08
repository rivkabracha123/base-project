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
  confirmedFacts: string[];
  uncertainFacts: string[];
  sellerConfirmation: {
    required: boolean;
    status: 'pending' | 'confirmed' | 'rejected';
  };
  hasContactDetails: boolean;
  hasImages: boolean;
};

export function isSellerHandoffContract(value: unknown): value is SellerHandoffContract {
  if (!value || typeof value !== 'object') return false;

  const handoff = value as Record<string, unknown>;
  const item = handoff.item;
  const sellerConfirmation = handoff.sellerConfirmation;
  if (!item || typeof item !== 'object') return false;
  if (!sellerConfirmation || typeof sellerConfirmation !== 'object') return false;

  const confirmation = sellerConfirmation as Record<string, unknown>;

  return (
    handoff.role === 'seller' &&
    (handoff.language === 'he' || handoff.language === 'en') &&
    typeof handoff.intent === 'string' && handoff.intent.trim().length > 0 &&
    typeof handoff.category === 'string' && handoff.category.trim().length > 0 &&
    Array.isArray(handoff.missingFacts) && handoff.missingFacts.every((fact) => typeof fact === 'string') &&
    Array.isArray(handoff.confirmedFacts) && handoff.confirmedFacts.every((fact) => typeof fact === 'string') &&
    Array.isArray(handoff.uncertainFacts) && handoff.uncertainFacts.every((fact) => typeof fact === 'string') &&
    typeof confirmation.required === 'boolean' &&
    (confirmation.status === 'pending' || confirmation.status === 'confirmed' || confirmation.status === 'rejected') &&
    typeof handoff.hasContactDetails === 'boolean' &&
    typeof handoff.hasImages === 'boolean'
  );
}