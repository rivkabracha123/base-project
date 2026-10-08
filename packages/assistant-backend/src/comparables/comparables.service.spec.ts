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

  it('passes the returned evidence to the S1 callback once', async () => {
    const service = makeService([soldRareBook, unsoldRareBook, soldJudaica]);
    const callback = jest.fn();
    const result = await service.findComparables({ category: 'rare_books', materials: ['paper'] }, callback);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(result);
  });

  it('waits for an async callback before resolving', async () => {
    const service = makeService([soldRareBook]);
    const order: string[] = [];
    await service.findComparables({ category: 'rare_books' }, async () => {
      await Promise.resolve();
      order.push('callback');
    });
    order.push('resolved');
    expect(order).toEqual(['callback', 'resolved']);
  });

  it('does not call the callback when the lot query fails', async () => {
    const failure = new Error('database unavailable');
    const repository = { find: jest.fn().mockRejectedValue(failure) } as unknown as Repository<AuctionLotEntity>;
    const service = new ComparablesService(repository);
    const callback = jest.fn();
    await expect(service.findComparables({ category: 'rare_books' }, callback)).rejects.toBe(failure);
    expect(callback).not.toHaveBeenCalled();
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

// Week 5 — sparse data. S3 keeps returning the full explained evidence however few credible sales
// exist; the three-sale minimum and the refusal belong to S4, so nothing here counts toward 3.
describe('ComparablesService — Week 5 sparse data and corrections', () => {
  function makeService(lots: AuctionLot[]): ComparablesService {
    const repository = {
      find: jest.fn().mockResolvedValue(lots.map(makeEntity)),
    } as unknown as Repository<AuctionLotEntity>;
    return new ComparablesService(repository);
  }

  const soldRareBook2: AuctionLot = {
    ...soldRareBook,
    id: 'lot-sold-rb-2',
    source: { ...soldRareBook.source, recordId: '2', url: 'https://example.com/2' },
    saleDate: '2024-06-01',
    realizedPrice: { amount: 4500, currency: 'ILS' },
  };
  const zeroPriceRareBook: AuctionLot = {
    ...soldRareBook,
    id: 'lot-zero-rb',
    source: { ...soldRareBook.source, recordId: '3', url: 'https://example.com/3' },
    realizedPrice: { amount: 0, currency: 'USD' },
  };

  it('returns empty included and excluded when there are no candidate lots', async () => {
    const result = await makeService([]).findComparables({ category: 'rare_books' });
    expect(result).toEqual({ included: [], excluded: [] });
  });

  it('returns one credible sale plus every excluded candidate with its reason', async () => {
    const result = await makeService([unsoldRareBook, soldRareBook, soldJudaica, zeroPriceRareBook])
      .findComparables({ category: 'rare_books' });

    expect(result.included.map(s => s.lot.id)).toEqual(['lot-sold-rb']);
    expect(result.excluded.map(s => s.lot.id).sort()).toEqual(['lot-sold-judaica', 'lot-unsold-rb', 'lot-zero-rb']);
    for (const s of result.excluded) expect(s.exclusionReason).toBeTruthy();
  });

  it('returns two credible sales without applying any minimum, keeping weak candidates excluded with reasons', async () => {
    const result = await makeService([soldRareBook, soldRareBook2, unsoldRareBook])
      .findComparables({ category: 'rare_books', materials: ['rare'] });

    // 'rare' is in "Rare Book A"; the second lot shares its text, so both are credible.
    expect(result.included.map(s => s.lot.id)).toEqual(['lot-sold-rb', 'lot-sold-rb-2']);
    expect(result.excluded.map(s => s.lot.id)).toEqual(['lot-unsold-rb']);

    const weak = await makeService([soldRareBook, soldRareBook2]).findComparables({ category: 'rare_books', materials: ['bronze'] });
    expect(weak.included).toHaveLength(0);
    for (const s of weak.excluded) expect(s.exclusionReason).toMatch(/similarity too weak/i);
  });

  it('uses the latest confirmed facts on each call, with no carry-over from an earlier result', async () => {
    const service = makeService([soldRareBook, soldRareBook2, soldJudaica]);

    const original = await service.findComparables({ category: 'rare_books', materials: ['rare'] });
    const corrected = await service.findComparables({ category: 'judaica' });
    const originalAgain = await service.findComparables({ category: 'rare_books', materials: ['rare'] });

    expect(original.included.map(s => s.lot.id)).toEqual(['lot-sold-rb', 'lot-sold-rb-2']);
    expect(corrected.included.map(s => s.lot.id)).toEqual(['lot-sold-judaica']);
    expect(corrected.excluded.map(s => s.lot.id).sort()).toEqual(['lot-sold-rb', 'lot-sold-rb-2']);
    expect(originalAgain).toEqual(original);
  });

  it('keeps each candidate\'s source and original money exactly as stored, included or excluded', async () => {
    const lots = [soldRareBook, soldRareBook2, unsoldRareBook, zeroPriceRareBook];
    const result = await makeService(lots).findComparables({ category: 'rare_books' });
    const byId = new Map(lots.map(lot => [lot.id, lot]));

    for (const s of [...result.included, ...result.excluded]) {
      const stored = byId.get(s.lot.id)!;
      expect(s.lot.source).toEqual(stored.source);
      expect(s.lot.realizedPrice).toEqual(stored.realizedPrice);
      expect(s.lot.estimate).toEqual(stored.estimate);
      expect(s.lot.saleDate).toBe(stored.saleDate);
    }
    // Original currency is preserved, never converted by S3.
    expect(result.included.find(s => s.lot.id === 'lot-sold-rb-2')!.lot.realizedPrice).toEqual({ amount: 4500, currency: 'ILS' });
  });
});
