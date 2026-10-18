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
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getRawAndEntities: jest.fn().mockResolvedValue({ entities: [{ payload: lot }], raw: [] }),
    getCount: jest.fn().mockResolvedValue(1),
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
      data: [{ lot, matchReasons: [] }],
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
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('lot.id', 'ASC');
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
    queryBuilder.getRawAndEntities.mockResolvedValueOnce({
      entities: validatedRecords.map((payload) => ({ payload })),
      raw: [],
    });
    queryBuilder.getCount.mockResolvedValueOnce(validatedRecords.length);

    // Consumer step (P2): a real search request through the actual controller/service.
    const response = await postSearch({ filters: { categories: ['rare_books'] } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.map((entry: { lot: AuctionLot }) => entry.lot.id)).toEqual(['lot-valid-1', 'lot-valid-2']);
    expect(
      body.data.every((entry: { lot: AuctionLot }) => entry.lot.title?.en && entry.lot.category),
    ).toBe(true);
  });

  it('serves a record with every optional field missing, fully intact', async () => {
    const minimalRecord = {
      id: 'lot-minimal-1',
      source: { provider: 'demo', recordId: 'minimal-1', url: 'https://example.com/minimal-1', retrievedAt: '2025-01-01T00:00:00.000Z' },
      auctionHouse: { id: 'house-1', name: 'Demo House' },
      auctionTitle: 'Demo Auction',
      lotNumber: '1',
      title: { en: 'Minimal lot' },
      description: { en: 'No optional fields at all.' },
      category: 'rare_books',
      saleDate: '2025-01-01',
      status: 'upcoming',
    };
    const { records: validatedRecords } = validateAuctionLotFixture([minimalRecord]);
    expect(validatedRecords).toHaveLength(1); // sanity check: minimal record is accepted, not rejected

    queryBuilder.getRawAndEntities.mockResolvedValueOnce({
      entities: validatedRecords.map((payload) => ({ payload })),
      raw: [],
    });
    queryBuilder.getCount.mockResolvedValueOnce(validatedRecords.length);

    const response = await postSearch({ filters: { categories: ['rare_books'] } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([{ lot: minimalRecord, matchReasons: [] }]);
  });

  it('answers a database failure with a 500 that leaks no internal detail', async () => {
    queryBuilder.getRawAndEntities.mockRejectedValueOnce(
      new Error('password authentication failed for user "secret_user"'),
    );

    const response = await postSearch({ query: 'Abrabanel' });

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('secret_user');
  });
});
