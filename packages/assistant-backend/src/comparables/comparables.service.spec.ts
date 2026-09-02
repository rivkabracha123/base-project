import type { Repository } from 'typeorm';
import type { AuctionLot } from '@monabid/shared';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { ComparablesService } from './comparables.service';

function makeEntity(lot: AuctionLot): AuctionLotEntity {
  return { id: lot.id, payload: lot, sourceProvider: lot.source.provider, sourceRecordId: lot.source.recordId, createdAt: new Date(), updatedAt: new Date() };
}

const soldRareBook: AuctionLot = {
  id: 'lot-sold-rb',
  source: { provider: 'demo', recordId: '1', url: 'https://example.com/1', retrievedAt: '2025-01-01T00:00:00.000Z' },
  auctionHouse: { id: 'h1', name: 'House' },
  auctionTitle: 'Auction',
  lotNumber: '1',
  title: { en: 'Rare Book A' },
  description: { en: 'Description.' },
  category: 'rare_books',
  saleDate: '2025-01-01',
  status: 'sold',
  realizedPrice: { amount: 1000, currency: 'USD' },
};

const unsoldRareBook: AuctionLot = {
  ...soldRareBook,
  id: 'lot-unsold-rb',
  status: 'unsold',
  realizedPrice: undefined,
};

const soldJudaica: AuctionLot = {
  ...soldRareBook,
  id: 'lot-sold-judaica',
  category: 'judaica',
  realizedPrice: { amount: 5000, currency: 'USD' },
};

describe('ComparablesService', () => {
  function makeService(lots: AuctionLot[]): ComparablesService {
    const repository = {
      find: jest.fn().mockResolvedValue(lots.map(makeEntity)),
    } as unknown as Repository<AuctionLotEntity>;
    return new ComparablesService(repository);
  }

  it('returns the sold same-category lot in included', async () => {
    const service = makeService([soldRareBook, unsoldRareBook, soldJudaica]);
    const result = await service.findComparables({ category: 'rare_books' });
    const includedIds = result.included.map(s => s.lot.id);
    expect(includedIds).toContain('lot-sold-rb');
    expect(includedIds).not.toContain('lot-unsold-rb');
    expect(includedIds).not.toContain('lot-sold-judaica');
  });

  it('places the unsold and different-category lots in excluded', async () => {
    const service = makeService([soldRareBook, unsoldRareBook, soldJudaica]);
    const result = await service.findComparables({ category: 'rare_books' });
    const excludedIds = result.excluded.map(s => s.lot.id);
    expect(excludedIds).toContain('lot-unsold-rb');
    expect(excludedIds).toContain('lot-sold-judaica');
  });

  it('returns an empty included list when no credible comparables exist', async () => {
    const service = makeService([unsoldRareBook]);
    const result = await service.findComparables({ category: 'rare_books' });
    expect(result.included).toHaveLength(0);
  });

  it('produces identical order for identical input on repeated calls', async () => {
    const lots = [soldRareBook, unsoldRareBook, soldJudaica];
    const service = makeService(lots);
    const first = await service.findComparables({ category: 'rare_books' });
    const second = await service.findComparables({ category: 'rare_books' });
    expect(first.included.map(s => s.lot.id)).toEqual(second.included.map(s => s.lot.id));
    expect(first.excluded.map(s => s.lot.id)).toEqual(second.excluded.map(s => s.lot.id));
  });

  it('every result carries the full lot payload and a non-empty reason', async () => {
    const service = makeService([soldRareBook, unsoldRareBook]);
    const result = await service.findComparables({ category: 'rare_books' });
    for (const s of [...result.included, ...result.excluded]) {
      expect(s.lot).toBeDefined();
      expect(s.matchReason).toBeTruthy();
    }
  });
});
