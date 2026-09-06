import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuctionLot } from '@monabid/shared';
import { Repository } from 'typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { PaginatedResult } from './paginated-result.interface';

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

  async searchByText(
    query: string = '',
    language: 'en' | 'he' = 'en',
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedResult<AuctionLot>> {
    const normalizedQuery = query.trim();

    // Return empty paginated structure if query is empty
    if (!normalizedQuery) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    // Escape special SQL wildcard characters ('%', '_') to match literal user input (e.g., "25%")
    const escapedQuery = normalizedQuery.replace(/[\\%_]/g, (char) => `\\${char}`);
    const searchPattern = `%${escapedQuery}%`;

    // Access nested JSON fields: payload -> title ->> 'en' / 'he'
    const qb = this.lots
      .createQueryBuilder('lot')
      .where(
        `(
          LOWER(lot.payload->'title'->>'en') LIKE LOWER(:query) ESCAPE '\\' OR
          LOWER(lot.payload->'title'->>'he') LIKE LOWER(:query) ESCAPE '\\' OR
          LOWER(lot.payload->'description'->>'en') LIKE LOWER(:query) ESCAPE '\\' OR
          LOWER(lot.payload->'description'->>'he') LIKE LOWER(:query) ESCAPE '\\'
        )`,
        { query: searchPattern }
      );

    // Calculate pagination parameters
    const offset = (page - 1) * limit;

    // Apply pagination and fetch items with total matching count
    const [entities, total] = await qb
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return {
      data: entities.map((entity) => entity.payload),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<AuctionLot> {
    const entity = await this.lots.findOneBy({ id });
    if (!entity) throw new NotFoundException(`Auction lot ${id} was not found`);
    return entity.payload;
  }
}