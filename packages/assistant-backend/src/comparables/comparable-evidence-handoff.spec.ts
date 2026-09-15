import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { auctionLotFixtureSchema, comparableEvidenceSchema } from '@monabid/shared';
import type { AuctionLot } from '@monabid/shared';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { ComparablesModule } from './comparables.module';
// Test-infrastructure-only import: used purely to run Aluma's own, unmodified module as a real
// second Nest app so the Week 4 test below can call her real HTTP endpoint. No file under
// `aluma-shilat/` is read for behavior beyond this — her controller/service/DTO are exercised
// exactly as any other HTTP caller would, never imported into production code here.
// Name kept exactly as she exports it (`AlomaShilatModule`, not `AlumaShilatModule`) — not our typo to fix.
import { AlomaShilatModule } from '../aluma-shilat/aluma-shilat.module';

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

// ---------------------------------------------------------------------------
// Week 4 — full producer→consumer HTTP handoff: S3 comparables → S4 Aluma Shilat
// valuation. Goes one step further than the Week 3 trace above: instead of only
// checking that the mapped shape matches Aluma's type, this calls her REAL
// `/api/aluma-shilat/valuation` endpoint (her own unmodified module, run as a
// second Nest app). No file under `aluma-shilat/` is changed — AlumaShilatModule
// is imported strictly as a black-box HTTP consumer, the same way any other
// caller of her public endpoint would use it.
// ---------------------------------------------------------------------------

// Shared fixture: 3 credible sold+realized comparables (same category, full materials match, so
// Aluma sees at least the minimum of three credible sales her rule requires), 1 weak-similarity
// exclusion, and 1 unsold+estimate exclusion. Distinct, descending saleDates on the three credible
// lots keep the ranking order unambiguous, and mixing ILS (Aluma's base currency, rate always 1)
// with USD on dates that already have a committed rate in fixtures/exchange-rates/rates.json
// proves original currency and price travel through the handoff unchanged.
const week4FixturePath = resolve(process.cwd(), '../../fixtures/demo-scenarios/s3-s4-comparable-handoff.json');
const week4Lots: AuctionLot[] = auctionLotFixtureSchema.parse(
  JSON.parse(readFileSync(week4FixturePath, 'utf8')),
);

describe('Week 4 — full HTTP handoff: comparables/query → included → Aluma Shilat /valuation', () => {
  let comparablesApp: INestApplication;
  let comparablesBaseUrl: string;
  let alumaApp: INestApplication;
  let alumaBaseUrl: string;

  beforeAll(async () => {
    const comparablesModuleRef = await Test.createTestingModule({
      imports: [ComparablesModule],
    })
      .overrideProvider(getRepositoryToken(AuctionLotEntity))
      .useValue({
        find: jest.fn().mockResolvedValue(week4Lots.map(makeEntity)),
      })
      .compile();

    comparablesApp = comparablesModuleRef.createNestApplication();
    comparablesApp.setGlobalPrefix('api');
    comparablesApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await comparablesApp.listen(0, '127.0.0.1');
    comparablesBaseUrl = await comparablesApp.getUrl();

    // GREEN (Week 4, step 2 of 2): run Aluma's own AlumaShilatModule, completely unmodified, as
    // a second real Nest app on its own port — the same black-box HTTP-consumer pattern already
    // used for her module in aluma-shilat.controller.spec.ts. No production code changes; this is
    // test infrastructure only, needed to actually exercise the S3 → S4 HTTP boundary end to end.
    const alumaModuleRef = await Test.createTestingModule({
      imports: [AlomaShilatModule],
    }).compile();

    alumaApp = alumaModuleRef.createNestApplication();
    alumaApp.setGlobalPrefix('api');
    alumaApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await alumaApp.listen(0, '127.0.0.1');
    alumaBaseUrl = await alumaApp.getUrl();
  });

  afterAll(async () => {
    await comparablesApp.close();
    await alumaApp.close();
  });

  it('sends only the credible included comparables to Aluma\'s real endpoint and gets back a deterministic, correctly-priced valuation', async () => {
    // Step 1: S3 query, real HTTP boundary.
    const queryResponse = await fetch(`${comparablesBaseUrl}/api/comparables/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'paintings', materials: ['oil', 'canvas'] }),
    });
    expect(queryResponse.status).toBe(200);
    const evidence = comparableEvidenceSchema.parse(await queryResponse.json());

    // Rule: only credible (sold + realized-price + strong-enough similarity) comparables are
    // included, ranked deterministically (score desc, then saleDate desc — all three tie on
    // score here, so saleDate desc alone decides the order).
    expect(evidence.included.map(s => s.lot.id)).toEqual([
      'w4-lot-credible-newest',
      'w4-lot-credible-middle',
      'w4-lot-credible-oldest',
    ]);

    // Rule: weak similarity must not appear credible, and unsold estimates must never count as
    // realized prices — both stay excluded, with reasons naming why.
    const excludedById = new Map(evidence.excluded.map(s => [s.lot.id, s]));
    expect(excludedById.get('w4-lot-weak-similarity')?.exclusionReason).toMatch(/similarity|weak/i);
    expect(excludedById.get('w4-lot-unsold-with-estimate')?.exclusionReason).toMatch(/not a completed sale|unsold/i);
    expect(excludedById.get('w4-lot-unsold-with-estimate')?.exclusionReason).not.toMatch(/3000|5000/);

    // Step 2: map only `included` into Aluma's own ComparableSaleInput shape (same test-only
    // mapping used by the Week 3 trace above) — currency and price travel through unchanged.
    const comparables = evidence.included.map(toComparableSaleInput);
    expect(comparables).toEqual([
      { id: 'w4-lot-credible-newest', saleDate: '2024-03-10', soldPrice: 4000, currency: 'USD', category: 'paintings', status: 'sold', source: 'demo' },
      { id: 'w4-lot-credible-middle', saleDate: '2024-02-20', soldPrice: 15000, currency: 'ILS', category: 'paintings', status: 'sold', source: 'demo' },
      { id: 'w4-lot-credible-oldest', saleDate: '2024-01-20', soldPrice: 3600, currency: 'USD', category: 'paintings', status: 'sold', source: 'demo' },
    ]);
    expect(comparables.some(c => c.id === 'w4-lot-weak-similarity')).toBe(false);
    expect(comparables.some(c => c.id === 'w4-lot-unsold-with-estimate')).toBe(false);

    // Step 3: POST the mapped payload to Aluma's REAL endpoint. itemId/itemVersion are
    // test-only placeholders — S3's ComparableEvidence has no such fields, and none are added
    // here; this is not a claim about where they come from in production.
    const valuationResponse = await fetch(`${alumaBaseUrl}/api/aluma-shilat/valuation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'test-item-1', itemVersion: 'v1', comparables }),
    });
    // Note: Aluma's controller has no @HttpCode(200) on this route (unlike her sibling
    // /comparables/query), so Nest returns its default POST status, 201 — asserted as observed,
    // not "fixed", since changing her controller is out of scope for this handoff.
    expect(valuationResponse.status).toBe(201);
    const valuation = await valuationResponse.json();

    // Deterministic, correctly-computed result: 3 credible sales, none excluded as outliers,
    // original currencies and dated FX rates preserved from the mapped payload above.
    expect(valuation).toMatchObject({
      status: 'supported',
      itemVersion: 'v1',
      comparableCount: 3,
      originalCurrencies: ['USD', 'ILS', 'USD'],
      baseCurrency: 'ILS',
      excludedOutliers: 0,
      includedComparableIds: ['w4-lot-credible-newest', 'w4-lot-credible-middle', 'w4-lot-credible-oldest'],
      excludedComparableIds: [],
      missingExchangeRateComparableIds: [],
      valuationRange: { min: 13104, max: 15000, currency: 'ILS' },
    });
    expect(valuation.fxRatesUsed).toEqual([
      { currency: 'USD', asOfDate: '2024-03-10' },
      { currency: 'USD', asOfDate: '2024-01-20' },
    ]);
    expect(typeof valuation.confidence).toBe('number');
    expect(valuation.confidence).toBeGreaterThanOrEqual(0);
    expect(valuation.confidence).toBeLessThanOrEqual(1);

    // Determinism: repeating the exact same round trip produces the exact same result.
    const repeatQueryResponse = await fetch(`${comparablesBaseUrl}/api/comparables/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'paintings', materials: ['oil', 'canvas'] }),
    });
    const repeatEvidence = comparableEvidenceSchema.parse(await repeatQueryResponse.json());
    expect(repeatEvidence.included.map(s => s.lot.id)).toEqual(evidence.included.map(s => s.lot.id));

    const repeatValuationResponse = await fetch(`${alumaBaseUrl}/api/aluma-shilat/valuation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'test-item-1', itemVersion: 'v1', comparables: repeatEvidence.included.map(toComparableSaleInput) }),
    });
    const repeatValuation = await repeatValuationResponse.json();
    expect(repeatValuation).toEqual(valuation);
  });
});
