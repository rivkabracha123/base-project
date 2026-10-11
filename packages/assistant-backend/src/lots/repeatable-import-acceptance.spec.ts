import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { type AuctionLot, validateAuctionLotFixture } from '@monabid/shared';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { LotsModule } from './lots.module';
import { ComparablesModule } from '../comparables/comparables.module';

// Mirrors packages/shared/src/repeatable-import.spec.ts — test-only, not production code.
class FakeAuctionLotStore {
  private records = new Map<string, AuctionLot>();

  importBatch(batch: unknown[]) {
    const { records, report } = validateAuctionLotFixture(batch);
    for (const record of records) {
      this.records.set(record.id, record);
    }
    return report;
  }

  all(): AuctionLot[] {
    return [...this.records.values()];
  }
}

const baseLot = {
  source: { provider: 'demo', recordId: 'trace-1', url: 'https://example.com/trace-1', retrievedAt: '2025-01-01T00:00:00.000Z' },
  auctionHouse: { id: 'house-1', name: 'Demo House' },
  auctionTitle: 'Demo Auction',
  lotNumber: '1',
  title: { en: 'Oil on canvas portrait' },
  description: { en: 'A signed oil on canvas painting.' },
  category: 'paintings',
  saleDate: '2025-03-01',
  status: 'sold' as const,
};

function makeEntity(lot: AuctionLot): AuctionLotEntity {
  return {
    id: lot.id,
    payload: lot,
    sourceProvider: lot.source.provider,
    sourceRecordId: lot.source.recordId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('Repeatable import acceptance path — reaches Mali and Heni after a correction', () => {
  let app: INestApplication;
  let baseUrl: string;
  const store = new FakeAuctionLotStore();

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getRawAndEntities: jest.fn(),
    getCount: jest.fn(),
  };
  const repository = {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    find: jest.fn(),
    findOneBy: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [LotsModule, ComparablesModule] })
      .overrideProvider(getRepositoryToken(AuctionLotEntity))
      .useValue(repository)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  function syncMocksWithStore() {
    const entities = store.all().map(makeEntity);
    repository.find.mockResolvedValue(entities);
    queryBuilder.getRawAndEntities.mockResolvedValue({ entities, raw: [] });
    queryBuilder.getCount.mockResolvedValue(entities.length);
  }

  it("reflects a correction at both Mali's search and Heni's comparables, after two import runs", async () => {
    const firstReport = store.importBatch([{ ...baseLot, id: 'trace-lot-1', realizedPrice: { amount: 4200, currency: 'USD' } }]);
    expect(firstReport).toMatchObject({ total: 1, accepted: 1, rejected: 0 });
    syncMocksWithStore();

    const searchAfterFirst = await fetch(`${baseUrl}/api/lots/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filters: { categories: ['paintings'] } }),
    }).then((r) => r.json());
    expect(
      searchAfterFirst.data.map((entry: { lot: AuctionLot }) => entry.lot.realizedPrice?.amount),
    ).toEqual([4200]);

    const comparablesAfterFirst = await fetch(`${baseUrl}/api/comparables/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ category: 'paintings' }),
    }).then((r) => r.json());
    expect(comparablesAfterFirst.included.map((s: { lot: AuctionLot }) => s.lot.realizedPrice?.amount)).toEqual([4200]);

    // Second import run: a correction — same id, updated price.
    const secondReport = store.importBatch([{ ...baseLot, id: 'trace-lot-1', realizedPrice: { amount: 4500, currency: 'USD' } }]);
    expect(secondReport).toMatchObject({ total: 1, accepted: 1, rejected: 0 });
    syncMocksWithStore();

    const searchAfterSecond = await fetch(`${baseUrl}/api/lots/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filters: { categories: ['paintings'] } }),
    }).then((r) => r.json());
    expect(searchAfterSecond.data).toHaveLength(1); // still one record, not two
    expect(
      searchAfterSecond.data.map((entry: { lot: AuctionLot }) => entry.lot.realizedPrice?.amount),
    ).toEqual([4500]);

    const comparablesAfterSecond = await fetch(`${baseUrl}/api/comparables/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ category: 'paintings' }),
    }).then((r) => r.json());
    expect(comparablesAfterSecond.included.map((s: { lot: AuctionLot }) => s.lot.realizedPrice?.amount)).toEqual([4500]);
  });
});
