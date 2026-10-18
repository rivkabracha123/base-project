import { Injectable } from '@nestjs/common';
import { sellerItemSchema, type SellerItem } from '@monabid/shared';
import { ComparablesService } from '../comparables/comparables.service';
import { mapEvidenceToValuationInput } from './comparable-evidence.mapper';
import { isSafeIdentifier } from './privacy-projection';
import { ValuationCalculationService, type ValuationResult } from './valuation-calculation.service';

export type ItemValuationRequest = { itemId: string; itemVersion: string; item: SellerItem };

// Thrown before any calculation when the request is outside the agreed contract. The message names
// the field only, never the rejected value, so it cannot leak sensitive input into logs or responses.
export class InvalidItemValuationRequestError extends Error {
  constructor(readonly field: 'request' | 'itemId' | 'itemVersion' | 'item') {
    super(`Invalid ${field}`);
    this.name = 'InvalidItemValuationRequestError';
  }
}

// itemId and itemVersion are copied into the report, so they must be identifier-shaped: a report must
// stay linked to the exact item and version, and a malformed value is rejected rather than rewritten.
function validate(request: unknown): ItemValuationRequest {
  if (typeof request !== 'object' || request === null) throw new InvalidItemValuationRequestError('request');
  const { itemId, itemVersion, item } = request as Record<string, unknown>;
  if (!isSafeIdentifier(itemId)) throw new InvalidItemValuationRequestError('itemId');
  if (!isSafeIdentifier(itemVersion)) throw new InvalidItemValuationRequestError('itemVersion');
  const parsedItem = sellerItemSchema.safeParse(item);
  if (!parsedItem.success) throw new InvalidItemValuationRequestError('item');
  return { itemId, itemVersion, item: parsedItem.data };
}

// S3 -> S4 orchestration: ask Heni's service for comparables, map them, then run the existing calculation.
// Kept separate from ValuationCalculationService so that module stays free of database dependencies.
@Injectable()
export class ItemValuationService {
  constructor(
    private readonly comparables: ComparablesService,
    private readonly valuation: ValuationCalculationService,
  ) {}

  async calculateFromItem(request: ItemValuationRequest): Promise<ValuationResult> {
    const { itemId, itemVersion, item } = validate(request);
    const evidence = await this.comparables.findComparables(item);
    return this.valuation.calculateValuation(mapEvidenceToValuationInput(evidence, itemId, itemVersion));
  }
}
