import type { BuyerCriteria, Constraint } from './buyer-criteria';

/** A non-negotiable buyer constraint retained for downstream consumers. */
export type { Constraint };

/** Full buyer intent retained for dashboard and later search stages. */
export interface BuyerSearchRequest {
  criteria: BuyerCriteria;
  language: 'en' | 'he';
  hardConstraints: Constraint[];
}
