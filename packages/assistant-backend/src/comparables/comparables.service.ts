import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ComparableEvidence, SellerItem } from '@monabid/shared';
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
  async findComparables(item: SellerItem): Promise<ComparableEvidence> {
    const entities = await this.lots.find();
    const scores = entities.map(e => scoreComparable(e.payload, item));
    return partitionAndSort(scores);
  }
}
