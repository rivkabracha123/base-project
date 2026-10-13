import { Inject, Injectable } from '@nestjs/common';
import {
  BuyerSearchOrchestrator,
  type BuyerSearchInput,
  type BuyerSearchOutcome,
  type BuyerSearchProgress,
  type LotsSearchClient,
} from './buyer-search.orchestrator';
import { LotsServiceSearchClient } from './lots-service-search.client';

/** B3 entry point for B4 — same as `BuyerSearchOrchestrator.search`, named for the contract. */
@Injectable()
export class BuyerSearchExecutionService {
  private readonly orchestrator: BuyerSearchOrchestrator;

  // An interface does not exist at runtime, so Nest cannot inject it by type; inject by the class token instead
  // while keeping the interface type so tests can pass any LotsSearchClient.
  constructor(@Inject(LotsServiceSearchClient) lotsSearch: LotsSearchClient) {
    this.orchestrator = new BuyerSearchOrchestrator(lotsSearch);
  }

  executeSearch(
    input: BuyerSearchInput,
    onProgress?: (progress: BuyerSearchProgress) => void,
  ): Promise<BuyerSearchOutcome> {
    return this.orchestrator.search(input, onProgress);
  }
}
