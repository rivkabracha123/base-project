import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { comparableEvidenceSchema } from '@monabid/shared';
import type { AuctionLot } from '@monabid/shared';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { ComparablesModule } from './comparables.module';
// Test-infrastructure-only import: used purely to run Aluma's own, unmodified module as a real
// second Nest app so the Week 4 test below can call her real HTTP endpoint. No file under
// `valuation-calculation/` is read for behavior beyond this — her controller/service/DTO are
// exercised exactly as any other HTTP caller would, never imported into production code here.
// Module renamed from `aluma-shilat`/`AlomaShilatModule` to `valuation-calculation`/`ValuationCalculationModule`
// as part of the Week 3→Week 4 merge; this import follows that rename.
import { ValuationCalculationModule } from '../valuation-calculation/valuation-calculation.module';

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
// valuation-calculation.service.ts / valuation-calculation.dto.ts for reference only — not
// imported). Kept local so this spec never depends on her module. `weight` is required on her
// real DTO (ComparableSaleDto), so it must be present here too.
type ComparableSaleInputShape = {
  id: string;
  saleDate: string;
  soldPrice: number;
  weight: number;
  currency: string;
  category: string;
  status: 'sold' | 'unsold' | 'upcoming';
  source: string;
};

// Approved contract boundary (S4-confirmed): Heni's (S3) ScoredComparable.score maps directly
// onto Aluma's (S4) ComparableSaleInput.weight — no renaming on S3's side, no normalization here.
// weight is a relative contribution to the calculation (higher score = higher relative weight);
// it is not a confidence value and not a probability — those are separate, unrelated concepts on
// Aluma's side (see the `confidence` object on her ValuationResult, asserted separately below).
function toComparableSaleInput(scored: { lot: AuctionLot; score: number }): ComparableSaleInputShape {
  const { lot, score } = scored;
  if (!lot.realizedPrice) {
    throw new Error(`Cannot build a comparable sale input for a lot without a realized price: ${lot.id}`);
  }
  return {
    id: lot.id,
    saleDate: lot.saleDate,
    soldPrice: lot.realizedPrice.amount,
    weight: score,
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
        weight: 1,
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
// Week 4 — full producer→consumer HTTP handoff: S3 comparables → S4 valuation-calculation
// (Aluma). Goes one step further than the Week 3 trace above: instead of only
// checking that the mapped shape matches Aluma's type, this calls her REAL
// `/api/valuation-calculation/valuation` endpoint (her own unmodified module, run as a
// second Nest app). No file under `valuation-calculation/` is changed — ValuationCalculationModule
// is imported strictly as a black-box HTTP consumer, the same way any other
// caller of her public endpoint would use it.
// ---------------------------------------------------------------------------

// Shared fixture: 3 credible sold+realized comparables (same category, full materials match).
// Distinct, descending saleDates on the three credible lots keep the ranking order unambiguous.
// Aluma's base currency is USD (not ILS): the USD lots (2024-03-10, 2024-01-20) have a rate of
// 1 by definition, and the ILS lot (2024-02-20) has no committed rate in
// fixtures/exchange-rates/rates.json for that date — so Aluma correctly refuses with
// missing_exchange_rate_data rather than inventing one. This still proves original currency and
// price travel through the handoff unchanged: S3 never converts, and Aluma's own missing-rate
// rule is what decides the outcome.
const credibleNewest: AuctionLot = {
  id: 'w4-lot-credible-newest',
  source: { provider: 'demo', recordId: 'w4-credible-newest', url: 'https://example.com/w4-credible-newest', retrievedAt: '2025-01-01T00:00:00.000Z' },
  auctionHouse: { id: 'house-1', name: 'Demo House' },
  auctionTitle: 'Demo Auction',
  lotNumber: '1',
  title: { en: 'Oil on canvas landscape' },
  description: { en: 'A signed oil on canvas painting, well preserved.' },
  category: 'paintings',
  saleDate: '2024-03-10',
  status: 'sold',
  realizedPrice: { amount: 4000, currency: 'USD' },
};

const credibleMiddle: AuctionLot = {
  ...credibleNewest,
  id: 'w4-lot-credible-middle',
  saleDate: '2024-02-20',
  realizedPrice: { amount: 15000, currency: 'ILS' },
};

const credibleOldest: AuctionLot = {
  ...credibleNewest,
  id: 'w4-lot-credible-oldest',
  saleDate: '2024-01-20',
  realizedPrice: { amount: 3600, currency: 'USD' },
};

const weakSimilarityLot: AuctionLot = {
  ...credibleNewest,
  id: 'w4-lot-weak-similarity',
  title: { en: 'Bronze sculpture' },
  description: { en: 'A cast bronze figure on a marble base.' },
  saleDate: '2024-02-01',
  realizedPrice: { amount: 900, currency: 'USD' },
};

const unsoldWithEstimateLotW4: AuctionLot = {
  ...credibleNewest,
  id: 'w4-lot-unsold-with-estimate',
  saleDate: '2024-02-15',
  status: 'unsold',
  realizedPrice: undefined,
  estimate: { low: { amount: 3000, currency: 'USD' }, high: { amount: 5000, currency: 'USD' } },
};

const week4Lots: AuctionLot[] = [
  credibleNewest,
  credibleMiddle,
  credibleOldest,
  weakSimilarityLot,
  unsoldWithEstimateLotW4,
];

// Week 4 — supported scenario: 3 credible sold+realized comparables whose currencies and sale
// dates are all already committed in fixtures/exchange-rates/rates.json (no fixture edits, no
// invented rates) — proves the same producer→consumer handoff can also return a real, computed
// 'supported' valuation, not only the missing-FX refusal below. USD needs no rate lookup at all,
// and EUR on 2024-02-15 has a real committed cross-rate.
const supportedNewest: AuctionLot = {
  id: 'w4-supported-newest',
  source: { provider: 'demo', recordId: 'w4-supported-newest', url: 'https://example.com/w4-supported-newest', retrievedAt: '2025-01-01T00:00:00.000Z' },
  auctionHouse: { id: 'house-1', name: 'Demo House' },
  auctionTitle: 'Demo Auction',
  lotNumber: '1',
  title: { en: 'Oil on canvas landscape' },
  description: { en: 'A signed oil on canvas painting, well preserved.' },
  category: 'paintings',
  saleDate: '2024-03-10',
  status: 'sold',
  realizedPrice: { amount: 4000, currency: 'USD' },
};

const supportedMiddle: AuctionLot = {
  ...supportedNewest,
  id: 'w4-supported-middle',
  saleDate: '2024-02-15',
  realizedPrice: { amount: 1000, currency: 'EUR' },
};

const supportedOldest: AuctionLot = {
  ...supportedNewest,
  id: 'w4-supported-oldest',
  saleDate: '2024-01-20',
  realizedPrice: { amount: 3600, currency: 'USD' },
};

describe('Week 4 — full HTTP handoff: comparables/query → included → valuation-calculation /valuation', () => {
  let comparablesApp: INestApplication;
  let comparablesBaseUrl: string;
  let valuationApp: INestApplication;
  let valuationBaseUrl: string;
  // Held in a named variable (rather than inline) so individual tests can override the resolved
  // lots via mockResolvedValueOnce, reusing the same running comparablesApp/valuationApp instead
  // of bootstrapping a fresh pair of Nest apps per scenario.
  let findAuctionLots: jest.Mock;

  beforeAll(async () => {
    findAuctionLots = jest.fn().mockResolvedValue(week4Lots.map(makeEntity));

    const comparablesModuleRef = await Test.createTestingModule({
      imports: [ComparablesModule],
    })
      .overrideProvider(getRepositoryToken(AuctionLotEntity))
      .useValue({
        find: findAuctionLots,
      })
      .compile();

    comparablesApp = comparablesModuleRef.createNestApplication();
    comparablesApp.setGlobalPrefix('api');
    comparablesApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await comparablesApp.listen(0, '127.0.0.1');
    comparablesBaseUrl = await comparablesApp.getUrl();

    // GREEN (Week 4, step 2 of 2): run Aluma's own ValuationCalculationModule, completely
    // unmodified, as a second real Nest app on its own port — the same black-box HTTP-consumer
    // pattern already used for her module in valuation-calculation.controller.spec.ts. No
    // production code changes; this is test infrastructure only, needed to actually exercise the
    // S3 → S4 HTTP boundary end to end.
    const valuationModuleRef = await Test.createTestingModule({
      imports: [ValuationCalculationModule],
    }).compile();

    valuationApp = valuationModuleRef.createNestApplication();
    valuationApp.setGlobalPrefix('api');
    valuationApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await valuationApp.listen(0, '127.0.0.1');
    valuationBaseUrl = await valuationApp.getUrl();
  });

  afterAll(async () => {
    await comparablesApp.close();
    await valuationApp.close();
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
    // mapping used by the Week 3 trace above) — currency, price, and score (as weight) travel
    // through unchanged.
    const comparables = evidence.included.map(toComparableSaleInput);
    expect(comparables).toEqual([
      { id: 'w4-lot-credible-newest', saleDate: '2024-03-10', soldPrice: 4000, weight: 1, currency: 'USD', category: 'paintings', status: 'sold', source: 'demo' },
      { id: 'w4-lot-credible-middle', saleDate: '2024-02-20', soldPrice: 15000, weight: 1, currency: 'ILS', category: 'paintings', status: 'sold', source: 'demo' },
      { id: 'w4-lot-credible-oldest', saleDate: '2024-01-20', soldPrice: 3600, weight: 1, currency: 'USD', category: 'paintings', status: 'sold', source: 'demo' },
    ]);
    expect(comparables.some(c => c.id === 'w4-lot-weak-similarity')).toBe(false);
    expect(comparables.some(c => c.id === 'w4-lot-unsold-with-estimate')).toBe(false);

    // Step 3: POST the mapped payload to Aluma's REAL endpoint. Per the approved S3/S4 contract,
    // itemId/itemVersion come from the approved item and its version at S1's integration layer —
    // S3 never invents them from sales data. For this Week 4 handoff test, explicit synthetic
    // identifiers are used in their place, as agreed. There is still no production adapter wiring
    // comparables/query into valuation-calculation/valuation; this file only proves the contract
    // via the test-only mapping (toComparableSaleInput, above), never as production code.
    const valuationResponse = await fetch(`${valuationBaseUrl}/api/valuation-calculation/valuation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'test-item-1', itemVersion: 'v1', comparables }),
    });
    // Note: Aluma's controller has no @HttpCode(200) on this route (unlike her sibling
    // /comparables/query), so Nest returns its default POST status, 201 — asserted as observed,
    // not "fixed", since changing her controller is out of scope for this handoff.
    expect(valuationResponse.status).toBe(201);
    const valuation = await valuationResponse.json();

    // Real, correctly-refused result: fixtures/exchange-rates/rates.json has no committed rate
    // for ILS on 2024-02-20, so 'w4-lot-credible-middle' is correctly dropped for a missing
    // exchange rate, leaving only 2 usable comparables — below Aluma's minimum of 3. This is her
    // real, current behavior (refusing rather than inventing a rate), not a stale expectation:
    // her base currency is USD (not ILS), and score is forwarded as weight for every comparable
    // (ComparableSaleDto.weight has no @IsOptional).
    expect(valuation).toMatchObject({
      status: 'refusal',
      reason: 'missing_exchange_rate_data',
      itemVersion: 'v1',
      comparableCount: 2,
      baseCurrency: 'USD',
      originalCurrencies: ['USD', 'ILS', 'USD'],
      includedComparableIds: ['w4-lot-credible-newest', 'w4-lot-credible-oldest'],
      excludedComparableIds: ['w4-lot-credible-middle'],
      missingExchangeRateComparableIds: ['w4-lot-credible-middle'],
      excludedComparables: [{ id: 'w4-lot-credible-middle', reason: 'missing_exchange_rate_data' }],
    });
    expect(valuation).not.toHaveProperty('valuationRange');
    expect(valuation.weights).toEqual([
      { id: 'w4-lot-credible-newest', weight: 1 },
      { id: 'w4-lot-credible-oldest', weight: 1 },
    ]);
    expect(valuation.fxRatesUsed).toEqual([
      { currency: 'USD', to: 'USD', rate: 1, asOfDate: '2024-03-10', source: 'identity' },
      { currency: 'USD', to: 'USD', rate: 1, asOfDate: '2024-01-20', source: 'identity' },
    ]);
    expect(valuation.confidence).toEqual({
      level: 'low',
      explanation: expect.stringContaining('uncalibrated'),
    });

    // Determinism: repeating the exact same round trip produces the exact same result (aside
    // from reportId, which is a fresh randomUUID on every call by design).
    const repeatQueryResponse = await fetch(`${comparablesBaseUrl}/api/comparables/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'paintings', materials: ['oil', 'canvas'] }),
    });
    const repeatEvidence = comparableEvidenceSchema.parse(await repeatQueryResponse.json());
    expect(repeatEvidence.included.map(s => s.lot.id)).toEqual(evidence.included.map(s => s.lot.id));

    const repeatValuationResponse = await fetch(`${valuationBaseUrl}/api/valuation-calculation/valuation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'test-item-1', itemVersion: 'v1', comparables: repeatEvidence.included.map(toComparableSaleInput) }),
    });
    const repeatValuation = await repeatValuationResponse.json();
    const { reportId: _valuationReportId, ...valuationWithoutReportId } = valuation;
    const { reportId: _repeatReportId, ...repeatValuationWithoutReportId } = repeatValuation;
    expect(repeatValuationWithoutReportId).toEqual(valuationWithoutReportId);
  });

  it('returns a supported valuation for 3 credible comparables whose currencies and dates all have real FX coverage', async () => {
    // Distinct dataset from the missing-FX scenario above, reusing the same running
    // comparablesApp/valuationApp via a one-time mock override.
    findAuctionLots.mockResolvedValueOnce(
      [supportedNewest, supportedMiddle, supportedOldest].map(makeEntity),
    );

    // Step 1: S3 query, real HTTP boundary.
    const queryResponse = await fetch(`${comparablesBaseUrl}/api/comparables/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'paintings', materials: ['oil', 'canvas'] }),
    });
    expect(queryResponse.status).toBe(200);
    const evidence = comparableEvidenceSchema.parse(await queryResponse.json());
    expect(evidence.included.map(s => s.lot.id)).toEqual([
      'w4-supported-newest',
      'w4-supported-middle',
      'w4-supported-oldest',
    ]);
    expect(evidence.excluded).toHaveLength(0);

    // Step 2: same test-only mapping as the scenario above — currency, price, and score (as
    // weight) travel through unchanged.
    const comparables = evidence.included.map(toComparableSaleInput);
    expect(comparables).toEqual([
      { id: 'w4-supported-newest', saleDate: '2024-03-10', soldPrice: 4000, weight: 1, currency: 'USD', category: 'paintings', status: 'sold', source: 'demo' },
      { id: 'w4-supported-middle', saleDate: '2024-02-15', soldPrice: 1000, weight: 1, currency: 'EUR', category: 'paintings', status: 'sold', source: 'demo' },
      { id: 'w4-supported-oldest', saleDate: '2024-01-20', soldPrice: 3600, weight: 1, currency: 'USD', category: 'paintings', status: 'sold', source: 'demo' },
    ]);

    // Step 3: POST to Aluma's REAL endpoint (same test-only itemId/itemVersion placeholders and
    // lack of a production adapter as documented above).
    const valuationResponse = await fetch(`${valuationBaseUrl}/api/valuation-calculation/valuation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'test-item-2', itemVersion: 'v1', comparables }),
    });
    expect(valuationResponse.status).toBe(201);
    const valuation = await valuationResponse.json();

    // Real, correctly-computed supported result: all 3 comparables have valid FX data, so none
    // are dropped, and Aluma returns an actual weighted USD range.
    expect(valuation).toMatchObject({
      status: 'supported',
      itemVersion: 'v1',
      comparableCount: 3,
      baseCurrency: 'USD',
      originalCurrencies: ['USD', 'EUR', 'USD'],
      includedComparableIds: ['w4-supported-newest', 'w4-supported-middle', 'w4-supported-oldest'],
      excludedComparableIds: [],
      missingExchangeRateComparableIds: [],
    });
    expect(valuation.valuationRange).toEqual({
      min: expect.any(Number),
      max: expect.any(Number),
      currency: 'USD',
    });
    expect(valuation.valuationRange.min).toBeGreaterThan(0);
    expect(valuation.valuationRange.min).toBeLessThan(valuation.valuationRange.max);
    expect(valuation.weights).toEqual([
      { id: 'w4-supported-newest', weight: 1 },
      { id: 'w4-supported-middle', weight: 1 },
      { id: 'w4-supported-oldest', weight: 1 },
    ]);
    expect(valuation.confidence).toEqual({
      level: 'low',
      explanation: expect.stringContaining('uncalibrated'),
    });
  });
});
