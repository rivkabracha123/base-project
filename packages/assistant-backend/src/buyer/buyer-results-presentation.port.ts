import type { BuyerCriteria } from './buyer-criteria';
import type { BuyerFlowOnUpdate, ResultCardGroup } from './buyer-flow.types';
import type { BuyerSearchOutcome } from './buyer-search.orchestrator';
import type { AuctionLot, Money } from '@monabid/shared';

export const BUYER_RESULTS_PRESENTATION_PORT = Symbol('BuyerResultsPresentationPort');

export type PresentSearchResultsInput = {
  /** Same as buyer criteria session id today. */
  searchContextId: string;
  criteria: BuyerCriteria;
  onUpdate: BuyerFlowOnUpdate;
  selectedLotId?: string;
};

export type PresentSearchResultsResult = {
  groups: ResultCardGroup[];
  /** Full B3 outcome — do not mutate. */
  outcome: BuyerSearchOutcome;
};

/** One verified sold lot used as evidence for a group price trend. */
export type PriceTrendPoint = {
  lotId: string;
  saleDate: string;
  title: string;
  price: Money;
};

export type PresentPriceTrendInput = {
  /** IDs from B3's most recent result groups — B4 does not choose similarity. */
  lots: { id: string }[];
  language: 'he' | 'en';
  onUpdate: BuyerFlowOnUpdate;
};

export type PresentPriceTrendResult = {
  lots: AuctionLot[];
  points: PriceTrendPoint[];
};

/**
 * B4 implements this port. B2 calls `presentSearchResults`; inside, B4 runs B3
 * (`BuyerSearchExecutionService.executeSearch`) and builds display groups.
 */
export interface BuyerResultsPresentationPort {
  presentSearchResults(input: PresentSearchResultsInput): Promise<PresentSearchResultsResult>;
  /** Optional while older integrations still use DefaultBuyerResultsPresentationService. */
  presentPriceTrend?(input: PresentPriceTrendInput): Promise<PresentPriceTrendResult>;
}
