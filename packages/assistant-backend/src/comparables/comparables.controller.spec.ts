import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { comparableEvidenceSchema } from '@monabid/shared';
import type { AuctionLot } from '@monabid/shared';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { ComparablesModule } from './comparables.module';

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

const soldRareBook: AuctionLot = {
  id: 'ctrl-lot-sold',
  source: { provider: 'demo', recordId: '1', url: 'https://example.com/1', retrievedAt: '2025-01-01T00:00:00.000Z' },
  auctionHouse: { id: 'h1', name: 'House' },
  auctionTitle: 'Auction',
  lotNumber: '1',
  title: { en: 'Rare Book' },
  description: { en: 'Description.' },
  category: 'rare_books',
  saleDate: '2025-01-01',
  status: 'sold',
  realizedPrice: { amount: 1000, currency: 'USD' },
};

const unsoldRareBook: AuctionLot = {
  ...soldRareBook,
  id: 'ctrl-lot-unsold',
  status: 'unsold',
  realizedPrice: undefined,
};

describe('ComparablesController (contract)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ComparablesModule],
    })
      .overrideProvider(getRepositoryToken(AuctionLotEntity))
      .useValue({
        find: jest.fn().mockResolvedValue([makeEntity(soldRareBook), makeEntity(unsoldRareBook)]),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    // Listen on an OS-assigned loopback port instead of using supertest, so the
    // real HTTP pipeline (pipes, status codes, JSON body) is exercised with only
    // Node's built-in global fetch — no extra test dependency required.
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  function postQuery(body: unknown): Promise<Response> {
    return fetch(`${baseUrl}/api/comparables/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('POST /api/comparables/query returns 200 with a schema-conforming body', async () => {
    const response = await postQuery({ category: 'rare_books' });

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(() => comparableEvidenceSchema.parse(body)).not.toThrow();
  });

  it('rejects an empty category string with 400', async () => {
    const response = await postQuery({ category: '' });

    expect(response.status).toBe(400);
  });

  it('rejects a missing category field with 400', async () => {
    const response = await postQuery({});

    expect(response.status).toBe(400);
  });

  it('rejects unknown fields with 400 (forbidNonWhitelisted)', async () => {
    const response = await postQuery({ category: 'rare_books', extra: 'yes' });

    expect(response.status).toBe(400);
  });

  it('returns only the credible sold lot in included, unsold in excluded', async () => {
    const response = await postQuery({ category: 'rare_books' });

    expect(response.status).toBe(200);
    const body = comparableEvidenceSchema.parse(await response.json());
    expect(body.included).toHaveLength(1);
    expect(body.included[0]!.lot.id).toBe('ctrl-lot-sold');
    expect(body.excluded.map(s => s.lot.id)).toContain('ctrl-lot-unsold');
  });
});
