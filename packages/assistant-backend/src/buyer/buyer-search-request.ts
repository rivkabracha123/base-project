import type { BuyerCriteria } from './buyer-criteria';

/** A non-negotiable buyer constraint retained for downstream consumers. */
export interface Constraint {
  field: 'budget' | 'category' | 'creator' | 'period' | 'location';
  operator: 'equal' | 'range' | 'contains';
  value: unknown;
  reason: string;
}

/** Full buyer intent retained for dashboard and later search stages. */
export interface BuyerSearchRequest {
  criteria: BuyerCriteria;
  language: 'en' | 'he';
  hardConstraints: Constraint[];
}
