import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { LotsService } from './lots.service';

const payload = {
  id: 'lot-1',
  source: { provider: 'fixture', recordId: '1', url: 'https://example.com/1', retrievedAt: '2025-01-01T00:00:00.000Z' },
  auctionHouse: { id: 'house-1', name: 'House' },
  auctionTitle: 'Auction',
  lotNumber: '1',
  title: { en: 'Lot', he: 'פריט' },
  description: { en: 'Description', he: 'תיאור' },
  category: 'books',
  saleDate: '2025-01-01',
  status: 'sold' as const,
};

describe('LotsService', () => {
  // Helper to create mock QueryBuilder supporting pagination chaining
  const createMockQueryBuilder = (entities: any[], total: number) => ({
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([entities, total]),
  });

  it('returns the first seeded fixture as the sample', async () => {
    const repository = { find: jest.fn().mockResolvedValue([{ payload }]) } as unknown as Repository<AuctionLotEntity>;
    await expect(new LotsService(repository).findSample()).resolves.toEqual(payload);
    expect(repository.find).toHaveBeenCalledWith({ order: { createdAt: 'ASC' }, take: 1 });
  });

  it('returns paginated lot records whose English title matches the search text', async () => {
    const queryBuilder = createMockQueryBuilder([{ payload }], 1);
    const repository = { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) } as unknown as Repository<AuctionLotEntity>;

    const result = await new LotsService(repository).searchByText('Atereth', 'en', 1, 10);

    // Verify paginated response structure
    expect(result).toEqual({
      data: [payload],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    expect(queryBuilder.skip).toHaveBeenCalledWith(0);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
    expect(queryBuilder.where).toHaveBeenCalledWith(
      expect.stringContaining(`LOWER(lot.payload->'title'->>'en') LIKE LOWER(:query)`),
      { query: '%Atereth%' }
    );
  });

  it('returns empty paginated structure when the query is empty', async () => {
    const repository = {} as Repository<AuctionLotEntity>;

    const result = await new LotsService(repository).searchByText('   ', 'en', 1, 10);

    // Expect empty PaginatedResult object
    expect(result).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
  });

  it('escapes literal percent and underscore characters and handles pagination parameters', async () => {
    const queryBuilder = createMockQueryBuilder([{ payload }], 1);
    const repository = { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) } as unknown as Repository<AuctionLotEntity>;

    const result = await new LotsService(repository).searchByText('50% off_sale', 'en', 2, 5);

    // Verify offset calculation for page 2 with limit 5 -> skip(5)
    expect(queryBuilder.skip).toHaveBeenCalledWith(5);
    expect(queryBuilder.take).toHaveBeenCalledWith(5);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(5);
  });

  it('returns canonical payloads without remapping source lineage', async () => {
    const repository = { findOneBy: jest.fn().mockResolvedValue({ payload }) } as unknown as Repository<AuctionLotEntity>;
    await expect(new LotsService(repository).findOne('lot-1')).resolves.toEqual(payload);
  });

  it('uses the standard not-found outcome', async () => {
    const repository = { findOneBy: jest.fn().mockResolvedValue(null) } as unknown as Repository<AuctionLotEntity>;
    await expect(new LotsService(repository).findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});