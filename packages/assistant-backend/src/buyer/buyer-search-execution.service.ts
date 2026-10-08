import { Injectable } from '@nestjs/common';
import {
  BuyerSearchOrchestrator,
  type BuyerSearchInput,
  type BuyerSearchOutcome,
  type BuyerSearchProgress,
} from './buyer-search.orchestrator';
import { LotsServiceSearchClient } from './lots-service-search.client';

/** B3 entry point for B4 — same as `BuyerSearchOrchestrator.search`, named for the contract. */
@Injectable()
export class BuyerSearchExecutionService {
  private readonly orchestrator: BuyerSearchOrchestrator;

  constructor(lotsSearch: LotsServiceSearchClient) {
    this.orchestrator = new BuyerSearchOrchestrator(lotsSearch);
  }

  executeSearch(
    input: BuyerSearchInput,
    onProgress?: (progress: BuyerSearchProgress) => void,
  ): Promise<BuyerSearchOutcome> {
    return this.orchestrator.search(input, onProgress);
  }
}
