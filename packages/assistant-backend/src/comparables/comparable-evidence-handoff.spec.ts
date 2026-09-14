import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { comparableEvidenceSchema } from '@monabid/shared';
import type { AuctionLot } from '@monabid/shared';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { ComparablesModule } from './comparables.module';

// Week 3 — Test 8: integration/contract boundary, named fixture "week3-comparable-ranking-trace".
//
// Traces: Efrat (S1 confirmed facts) + Avital (P1 historical lots)
//         → Heni (S3 ranking, this feature, through the REAL HTTP boundary — same path as Test 7)
//         → a test-only mapping into Aluma's (S4) ComparableSaleInput shape.
//
// This file adds no production code, and does not import anything from `../valuation-calculation/` — the
// target shape is reproduced locally (duck-typed) below, so this test never depends on, and never
// has write access to, S4's owned module. It is allowed under the session rule: "test-only
// mapping/adapter inside comparables/ for verification of the handoff".

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

// Avital (P1) — historical lots for the named fixture.
const strongMatchSoldLot: AuctionLot = {
  id: 'trace-lot-strong',
  source: { provider: 'demo', recordId: 'trace-1', url: 'https://example.com/trace-1', retrievedAt: '2025-01-01T00:00:00.000Z' },
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

const weakMatchSoldLot: AuctionLot = {
  ...strongMatchSoldLot,
  id: 'trace-lot-weak',
  title: { en: 'Bronze sculpture' },
  description: { en: 'A cast bronze figure on a marble base.' },
  realizedPrice: { amount: 900, currency: 'USD' },
};

const unsoldWithEstimateLot: AuctionLot = {
  ...strongMatchSoldLot,
  id: 'trace-lot-unsold',
  status: 'unsold',
  realizedPrice: undefined,
  estimate: { low: { amount: 3000, currency: 'USD' }, high: { amount: 5000, currency: 'USD' } },
};

// A minimal, locally-defined shape matching Aluma's (S4) ComparableSaleInput (read from
// valuation-calculation.service.ts for reference only — not imported). Kept local so this spec never
// depends on her module.
type ComparableSaleInputShape = {
  id: string;
  saleDate: string;
  soldPrice: number;
  currency: string;
  category: string;
  status: 'sold' | 'unsold' | 'upcoming';
  source: string;
};

function toComparableSaleInput(scored: { lot: AuctionLot }): ComparableSaleInputShape {
  const { lot } = scored;
  if (!lot.realizedPrice) {
    throw new Error(`Cannot build a comparable sale input for a lot without a realized price: ${lot.id}`);
  }
  return {
    id: lot.id,
    saleDate: lot.saleDate,
    soldPrice: lot.realizedPrice.amount,
    currency: lot.realizedPrice.currency,
    category: lot.category,
    status: lot.status as 'sold' | 'unsold' | 'upcoming',
    source: lot.source.provider,
  };
}

describe('Week 3 integration boundary — named fixture "week3-comparable-ranking-trace"', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ComparablesModule],
    })
      .overrideProvider(getRepositoryToken(AuctionLotEntity))
      .useValue({
        find: jest.fn().mockResolvedValue(
          [strongMatchSoldLot, weakMatchSoldLot, unsoldWithEstimateLot].map(makeEntity),
        ),
      })
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

  it('traces S1 confirmed facts + P1 historical lots through the real HTTP boundary into a stable ComparableEvidence, then maps cleanly into S4\'s ComparableSaleInput shape', async () => {
    // Efrat (S1) confirmed facts, sent exactly as the real caller would via the HTTP boundary.
    const response = await fetch(`${baseUrl}/api/comparables/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'paintings', materials: ['oil', 'canvas'] }),
    });

    expect(response.status).toBe(200);
    const body = comparableEvidenceSchema.parse(await response.json());

    // Only the strong, credible, sold+realized comparable is credible evidence.
    expect(body.included.map(s => s.lot.id)).toEqual(['trace-lot-strong']);
    const excludedIds = body.excluded.map(s => s.lot.id);
    expect(excludedIds).toContain('trace-lot-weak');
    expect(excludedIds).toContain('trace-lot-unsold');

    // Test-only mapping into S4's (Aluma) input shape — proves the handoff is usable downstream
    // without redesigning either contract, and that only real lot data (never an estimate) is used.
    const mapped = body.included.map(toComparableSaleInput);
    expect(mapped).toEqual([
      {
        id: 'trace-lot-strong',
        saleDate: '2025-03-01',
        soldPrice: 4200,
        currency: 'USD',
        category: 'paintings',
        status: 'sold',
        source: 'demo',
      },
    ]);
    expect(mapped.some(m => m.id === 'trace-lot-unsold')).toBe(false);
    expect(mapped.some(m => m.id === 'trace-lot-weak')).toBe(false);
  });
});
