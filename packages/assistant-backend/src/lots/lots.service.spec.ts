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
  title: { en: 'Lot' },
  description: { en: 'Description' },
  category: 'books',
  saleDate: '2025-01-01',
  status: 'sold' as const,
};

describe('LotsService', () => {
  it('returns the first seeded fixture as the sample', async () => {
    const repository = { find: jest.fn().mockResolvedValue([{ payload }]) } as unknown as Repository<AuctionLotEntity>;
    await expect(new LotsService(repository).findSample()).resolves.toEqual(payload);
    expect(repository.find).toHaveBeenCalledWith({ order: { createdAt: 'ASC' }, take: 1 });
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
