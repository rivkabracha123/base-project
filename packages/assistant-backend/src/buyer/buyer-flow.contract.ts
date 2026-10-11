/**
 * B2 ↔ B4 integration surface (pull `monabid-w5-eliana` — Batya implements
 * `BuyerResultsPresentationPort`; register in `buyer.module.ts` instead of Default*).
 */
export {
  BUYER_RESULTS_PRESENTATION_PORT,
  type BuyerResultsPresentationPort,
  type PresentSearchResultsInput,
  type PresentSearchResultsResult,
} from './buyer-results-presentation.port';
export type {
  BuyerFlowOnUpdate,
  BuyerFlowUpdate,
  ResultCardGroup,
  ResultCardItem,
} from './buyer-flow.types';
export { BuyerSearchExecutionService } from './buyer-search-execution.service';
export type {
  BuyerSearchInput,
  BuyerSearchOutcome,
  BuyerSearchProgress,
} from './buyer-search.orchestrator';
export type { MatchReason, ExplainedLot, GroupedResults } from './explained-results';
