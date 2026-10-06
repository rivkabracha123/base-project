import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { type AuctionLot, validateAuctionLotFixture } from '@monabid/shared';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { LotsModule } from './lots.module';

// A single canonical lot, matching the committed fixture shape.
const lot: AuctionLot = {
  id: 'lot-kestenbaum-54554-121421',
  source: {
    provider: 'bidspirit-snapshot',
    recordId: 'kestenbaum-54554-121421',
    url: 'https://il.bidspirit.com/ui/catalog/auction/kestenbaum/54554?lang=en',
    retrievedAt: '2025-08-21T00:00:00.000Z',
  },
  auctionHouse: { id: 'house-kestenbaum', name: 'Kestenbaum & Company' },
  auctionTitle: 'Rare Hebrew Printed Books, Manuscripts & Important American Judaica',
  lotNumber: '1',
  title: { en: 'Atereth Zekeinim by Yitzhak Abrabanel', he: 'עטרת זקנים מאת יצחק אברבנאל' },
  description: { en: 'A rare Hebrew printed philosophy volume.', he: 'ספר פילוסופיה עברי נדיר.' },
  category: 'rare_books',
  saleDate: '2025-01-23',
  status: 'sold',
};

describe('Lots API (integration)', () => {
  let app: INestApplication;
  let baseUrl: string;

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[{ payload: lot }], 1]),
  };
  const repository = {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    find: jest.fn().mockResolvedValue([{ payload: lot }]),
    findOneBy: jest.fn().mockResolvedValue({ payload: lot }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [LotsModule] })
      .overrideProvider(getRepositoryToken(AuctionLotEntity))
      .useValue(repository)
      .compile();

    app = moduleRef.createNestApplication();
    // Mirror the global HTTP configuration from main.ts.
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const postSearch = (body: unknown) =>
    fetch(`${baseUrl}/api/lots/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('accepts a filtered search body and returns the typed paginated contract', async () => {
    const response = await postSearch({ filters: { categories: ['rare_books'] } });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [lot],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    // the filter reached the query, and the canonical lot came back unchanged
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("payload->>'category' IN (:...categories)"),
      { categories: ['rare_books'] },
    );
  });

  it('rejects an invalid search body', async () => {
    const response = await postSearch({ filters: { price: { min: -5 } } });

    expect(response.status).toBe(400);
  });

  it('orders results deterministically before paginating', async () => {
    const response = await postSearch({ query: 'book', page: 2, limit: 5 });

    expect(response.status).toBe(200);
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('lot.id', 'ASC');
    expect(queryBuilder.skip).toHaveBeenCalledWith(5);
    expect(queryBuilder.take).toHaveBeenCalledWith(5);
  });

  it('serves the wired sample route', async () => {
    const response = await fetch(`${baseUrl}/api/lots/sample`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(lot);
  });

  it('serves only the validated canonical records to the search consumer', async () => {
    // Raw import batch: two valid lots plus one broken record that must never reach the consumer.
    const rawImportBatch = [
      { ...lot, id: 'lot-valid-1' },
      { ...lot, id: 'lot-valid-2' },
      { id: 'lot-broken-1' }, // missing every required field but id
    ];

    // Producer step (P1): validate the raw batch before anything is served.
    const { records: validatedRecords } = validateAuctionLotFixture(rawImportBatch);
    expect(validatedRecords).toHaveLength(2); // sanity check: the broken record was filtered here

    // Seed the mocked DB with only what validation accepted.
    queryBuilder.getManyAndCount.mockResolvedValueOnce([
      validatedRecords.map((payload) => ({ payload })),
      validatedRecords.length,
    ]);

    // Consumer step (P2): a real search request through the actual controller/service.
    const response = await postSearch({ filters: { categories: ['rare_books'] } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.map((entry: AuctionLot) => entry.id)).toEqual(['lot-valid-1', 'lot-valid-2']);
    expect(body.data.every((entry: AuctionLot) => entry.title?.en && entry.category)).toBe(true);
  });
});
