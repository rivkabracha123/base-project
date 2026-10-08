import type { BuyerCriteria } from './buyer-criteria';
import type { BuyerFlowOnUpdate, ResultCardGroup } from './buyer-flow.types';
import type { BuyerSearchOutcome } from './buyer-search.orchestrator';

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

/**
 * B4 implements this port. B2 calls `presentSearchResults`; inside, B4 runs B3
 * (`BuyerSearchExecutionService.executeSearch`) and builds display groups.
 */
export interface BuyerResultsPresentationPort {
  presentSearchResults(input: PresentSearchResultsInput): Promise<PresentSearchResultsResult>;
}
