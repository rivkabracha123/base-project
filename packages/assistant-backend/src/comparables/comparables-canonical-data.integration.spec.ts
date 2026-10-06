import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { type AuctionLot, validateAuctionLotFixture } from '@monabid/shared';
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

const baseLot: AuctionLot = {
  id: 'lot-base',
  source: { provider: 'demo', recordId: 'base-1', url: 'https://example.com/base-1', retrievedAt: '2025-01-01T00:00:00.000Z' },
  auctionHouse: { id: 'house-1', name: 'Demo House' },
  auctionTitle: 'Demo Auction',
  lotNumber: '1',
  title: { en: 'Oil on canvas portrait' },
  description: { en: 'A signed oil on canvas painting.' },
  category: 'paintings',
  saleDate: '2025-03-01',
  status: 'sold',
  realizedPrice: { amount: 4200, currency: 'USD' },
};

describe('Comparables API consumes only P1-validated canonical records', () => {
  let app: INestApplication;
  let baseUrl: string;
  let validatedCount: number;

  beforeAll(async () => {
    // Producer step (P1): validate a raw batch that includes one broken record.
    const rawImportBatch = [
      { ...baseLot, id: 'lot-valid-1' },
      { id: 'lot-broken-1' }, // missing every required field but id — must never reach S3
    ];
    const { records: validatedRecords } = validateAuctionLotFixture(rawImportBatch);
    validatedCount = validatedRecords.length;

    const moduleRef = await Test.createTestingModule({ imports: [ComparablesModule] })
      .overrideProvider(getRepositoryToken(AuctionLotEntity))
      .useValue({ find: jest.fn().mockResolvedValue(validatedRecords.map(makeEntity)) })
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

  it('never returns the broken record, included or excluded', async () => {
    expect(validatedCount).toBe(1); // sanity check: the broken record was filtered here

    const response = await fetch(`${baseUrl}/api/comparables/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'paintings' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    const allIds = [...body.included, ...body.excluded].map((s: { lot: AuctionLot }) => s.lot.id);

    expect(allIds).toEqual(['lot-valid-1']);
  });
});
