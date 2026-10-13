import { isCompletionState, type CompletionState } from './completion-state';

// Define and validate the seller handoff contract
export type SellerHandoffContract = {
  role: 'seller';
  language: 'he' | 'en';
  intent: string;
  category: string;
  item: {
    title?: string;
    dimensions?: {
      values: Array<{ label: string; value: number; unit: string }>;
    };
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
  completionState?: CompletionState;
};

export function isSellerHandoffContract(value: unknown): value is SellerHandoffContract {
  if (!value || typeof value !== 'object') return false;

  const handoff = value as Record<string, unknown>;
  const item = handoff.item;
  const sellerConfirmation = handoff.sellerConfirmation;
  if (!item || typeof item !== 'object') return false;
  if (!sellerConfirmation || typeof sellerConfirmation !== 'object') return false;

  const confirmation = sellerConfirmation as Record<string, unknown>;
  const itemRecord = item as Record<string, unknown>;
  const itemFields = ['title', 'condition', 'markings', 'signature', 'provenance'] as const;
  const dimensions = itemRecord.dimensions;
  const validDimensions = dimensions === undefined || (
    Boolean(dimensions) &&
    typeof dimensions === 'object' &&
    !Array.isArray(dimensions) &&
    Array.isArray((dimensions as Record<string, unknown>).values) &&
    ((dimensions as { values: unknown[] }).values.length > 0) &&
    ((dimensions as { values: unknown[] }).values.every((measurement) => {
      if (!measurement || typeof measurement !== 'object' || Array.isArray(measurement)) return false;
      const value = measurement as Record<string, unknown>;
      return typeof value.label === 'string' && value.label.trim().length > 0
        && typeof value.value === 'number' && Number.isFinite(value.value) && value.value >= 0
        && typeof value.unit === 'string' && value.unit.trim().length > 0;
    }))
  );

  return (
    handoff.role === 'seller' &&
    (handoff.language === 'he' || handoff.language === 'en') &&
    typeof handoff.intent === 'string' && handoff.intent.trim().length > 0 &&
    typeof handoff.category === 'string' && handoff.category.trim().length > 0 &&
    itemFields.every((field) => itemRecord[field] === undefined || typeof itemRecord[field] === 'string') &&
    validDimensions &&
    (itemRecord.notes === undefined || (Array.isArray(itemRecord.notes) && itemRecord.notes.every((note) => typeof note === 'string'))) &&
    Array.isArray(handoff.missingFacts) && handoff.missingFacts.every((fact) => typeof fact === 'string') &&
    Array.isArray(handoff.confirmedFacts) && handoff.confirmedFacts.every((fact) => typeof fact === 'string') &&
    Array.isArray(handoff.uncertainFacts) && handoff.uncertainFacts.every((fact) => typeof fact === 'string') &&
    typeof confirmation.required === 'boolean' &&
    (confirmation.status === 'pending' || confirmation.status === 'confirmed' || confirmation.status === 'rejected') &&
    typeof handoff.hasContactDetails === 'boolean' &&
    typeof handoff.hasImages === 'boolean' &&
    (handoff.completionState === undefined || isCompletionState(handoff.completionState))
  );
}