import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ComparableEvidence, ComparableEvidenceCallback, SellerItem } from '@monabid/shared';
import { Repository } from 'typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { scoreComparable, partitionAndSort } from './comparable-score';

@Injectable()
export class ComparablesService {
  constructor(
    @InjectRepository(AuctionLotEntity)
    private readonly lots: Repository<AuctionLotEntity>,
  ) {}

  // Produces the ComparableEvidence handoff for S4: every lot is scored and kept (included or
  // excluded with a reason) rather than silently dropped, so the seller can see the full picture.
  // The optional callback lets S1 continue its flow with the same evidence; the HTTP endpoint and
  // other callers that omit it are unchanged.
  async findComparables(
    item: SellerItem,
    callback: ComparableEvidenceCallback = () => undefined,
  ): Promise<ComparableEvidence> {
    const entities = await this.lots.find();
    const scores = entities.map(e => scoreComparable(e.payload, item));
    const evidence = partitionAndSort(scores);
    await callback(evidence);
    return evidence;
  }
}
