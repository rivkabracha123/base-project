import { Injectable } from '@nestjs/common';
import type { SellerItem } from '@monabid/shared';
import { ComparablesService } from '../comparables/comparables.service';
import { mapEvidenceToValuationInput } from './comparable-evidence.mapper';
import { ValuationCalculationService, type ValuationResult } from './valuation-calculation.service';

export type ItemValuationRequest = { itemId: string; itemVersion: string; item: SellerItem };

// S3 -> S4 orchestration: ask Heni's service for comparables, map them, then run the existing calculation.
// Kept separate from ValuationCalculationService so that module stays free of database dependencies.
@Injectable()
export class ItemValuationService {
  constructor(
    private readonly comparables: ComparablesService,
    private readonly valuation: ValuationCalculationService,
  ) {}

  async calculateFromItem({ itemId, itemVersion, item }: ItemValuationRequest): Promise<ValuationResult> {
    const evidence = await this.comparables.findComparables(item);
    return this.valuation.calculateValuation(mapEvidenceToValuationInput(evidence, itemId, itemVersion));
  }
}
