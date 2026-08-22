import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuctionLot } from '@monabid/shared';
import { Repository } from 'typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';

@Injectable()
export class LotsService {
  constructor(
    @InjectRepository(AuctionLotEntity)
    private readonly lots: Repository<AuctionLotEntity>,
  ) {}

  async findSample(): Promise<AuctionLot> {
    const [entity] = await this.lots.find({ order: { createdAt: 'ASC' }, take: 1 });
    if (!entity) throw new NotFoundException('No fixture lots are available');
    return entity.payload;
  }

  async findOne(id: string): Promise<AuctionLot> {
    const entity = await this.lots.findOneBy({ id });
    if (!entity) throw new NotFoundException(`Auction lot ${id} was not found`);
    return entity.payload;
  }
}
