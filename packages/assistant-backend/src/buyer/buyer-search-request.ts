import type { BuyerCriteria, Constraint } from './buyer-criteria';

export type { Constraint };

export interface BuyerSearchRequest {
  criteria: BuyerCriteria;
  language: 'en' | 'he';
  hardConstraints: Constraint[];
}
