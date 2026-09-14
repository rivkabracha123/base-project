// Test file: runs and verifies the ValuationCalculationService valuation logic (executed via jest).
import { ValuationCalculationService, type ValuationInput } from './valuation-calculation.service';

type ComparableSale = NonNullable<ValuationInput['comparables']>[number];

const makeComparable = (overrides: Partial<ComparableSale> = {}): ComparableSale => ({
  id: 'c-1',
  saleDate: '2024-03-10',
  weight: 1,
  soldPrice: 100000,
  currency: 'ILS',
  category: 'furniture',
  status: 'sold',
  source: 'auction-house-a',
  ...overrides,
});

const makeInput = (overrides: Partial<ValuationInput> = {}): ValuationInput => ({
  itemId: 'lot-default',
  itemVersion: 'v1',
  comparables: [
    makeComparable({ id: 'c-1', soldPrice: 120000, currency: 'ILS' }),
    makeComparable({ id: 'c-2', soldPrice: 130000, currency: 'ILS' }),
    makeComparable({ id: 'c-3', soldPrice: 125000, currency: 'ILS' }),
  ],
  ...overrides,
});

const insufficientComparableSalesFixture = makeInput({
  itemVersion: 'v1',
  comparables: [
    makeComparable({ id: 'c-1', soldPrice: 120000 }),
    makeComparable({ id: 'c-2', soldPrice: 130000 }),
  ],
});

const supportedComparableSalesFixture = makeInput({
  itemVersion: 'v2',
});

describe('ValuationCalculationService', () => {
  let service: ValuationCalculationService;

  beforeEach(() => {
    service = new ValuationCalculationService();
  });

  describe('calculateValuation', () => {
    // Test #1: The service refuses valuation when fewer than three credible sales are available.
    it('refuses a valuation when there are fewer than three credible comparable sales', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation(insufficientComparableSalesFixture);

      expect(result).toMatchObject({
        status: 'refusal',
        reason: 'insufficient_comparable_sales',
        itemVersion: 'v1',
      });
    });

    // Test #2: The service supports valuation when at least three credible sales are available.
    it('supports a valuation when there are at least three credible comparable sales', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation(supportedComparableSalesFixture);

      expect(result).toMatchObject({
        status: 'supported',
        itemVersion: 'v2',
        comparableCount: 3,
      });
    });

    // Test #3: The service returns the same versioned result for identical input.
    it('returns a deterministic, versioned result for the same input', async () => {
      const service = new ValuationCalculationService();

      const firstResult = await service.calculateValuation(supportedComparableSalesFixture);
      const secondResult = await service.calculateValuation(supportedComparableSalesFixture);

      const { reportId: firstId, ...firstEvidence } = firstResult;
      const { reportId: secondId, ...secondEvidence } = secondResult;
      expect(firstEvidence).toEqual(secondEvidence);
      expect(firstId).not.toBe(secondId);
      expect(firstResult).toMatchObject({
        status: 'supported',
        itemVersion: 'v2',
        comparableCount: 3,
      });
    });

    // Test #4: The result preserves the original currencies of comparable sales for traceability.
    it('keeps the original currencies visible for traceability in a supported valuation', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation({
        itemId: 'lot-789',
        itemVersion: 'v3',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            weight: 1,
            soldPrice: 120000,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            weight: 1,
            soldPrice: 130000,
            currency: 'EUR',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
            weight: 1,
            soldPrice: 125000,
            currency: 'GBP',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });

      expect(result).toMatchObject({
        status: 'supported',
        itemVersion: 'v3',
        originalCurrencies: ['USD', 'EUR', 'GBP'],
      });
    });

    // USD is the base currency, regardless of the sale date.
    it('keeps USD prices in USD across sale dates', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation({
        itemId: 'lot-101',
        itemVersion: 'v4',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            weight: 1,
            soldPrice: 1000,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            weight: 1,
            soldPrice: 1200,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
            weight: 1,
            soldPrice: 1100,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });

      expect(result).toMatchObject({
        status: 'supported',
        itemVersion: 'v4',
        baseCurrency: 'USD',
      });
    });

    // The result contains a weighted USD range derived from comparable sales.
    it('returns a stable valuation range from the weighted comparable sales', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation({
        itemId: 'lot-202',
        itemVersion: 'v5',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            weight: 1,
            soldPrice: 100000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            weight: 1,
            soldPrice: 120000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
            weight: 1,
            soldPrice: 110000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });

      expect(result).toMatchObject({
        status: 'supported',
        itemVersion: 'v5',
        valuationRange: {
          min: expect.any(Number),
          max: expect.any(Number),
          currency: 'USD',
        },
      });
    });

    // Test #7: The normalized valuation range remains identical across repeated calculations.
    it('uses the same normalized range on repeated runs', async () => {
      const service = new ValuationCalculationService();

      const firstResult = await service.calculateValuation(supportedComparableSalesFixture);
      const secondResult = await service.calculateValuation(supportedComparableSalesFixture);

      expect(firstResult.valuationRange).toEqual(secondResult.valuationRange);
    });

    // Accepted evidence is not discarded by the obsolete twice-the-minimum rule.
    it('retains divergent accepted sales when their weighted range is usable', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation({
        itemId: 'lot-303',
        itemVersion: 'v6',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            weight: 1,
            soldPrice: 120000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            weight: 1,
            soldPrice: 119000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
            weight: 1,
            soldPrice: 500000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });

      expect(result).toMatchObject({
        status: 'supported',
        itemVersion: 'v6',
        comparableCount: 3,
        includedComparableIds: ['c-1', 'c-2', 'c-3'],
        excludedComparableIds: [],
      });
    });

    // Confidence is explicitly qualitative and uncalibrated.
    it('returns a confidence score describing how reliable the valuation is', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation({
        itemId: 'lot-404',
        itemVersion: 'v7',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            weight: 1,
            soldPrice: 100000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            weight: 1,
            soldPrice: 110000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
            weight: 1,
            soldPrice: 105000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });

      expect(result).toMatchObject({
        status: 'supported',
        itemVersion: 'v7',
        confidence: { level: 'low', explanation: expect.stringContaining('uncalibrated') },
      });
    });

    // Test #10: The service refuses valuation when sufficient sales still provide weak evidence.
    it('refuses a non-positive range under extreme dispersion even with three sales', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation({
        itemId: 'lot-505',
        itemVersion: 'v8',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            weight: 1,
            soldPrice: 80000,
            currency: 'ILS',
            category: 'electronics',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            weight: 1,
            soldPrice: 90000,
            currency: 'ILS',
            category: 'electronics',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
            weight: 1,
            soldPrice: 5000000,
            currency: 'ILS',
            category: 'electronics',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });

      expect(result).toMatchObject({
        status: 'refusal',
        reason: 'unusable_range_requires_expert_review',
        itemVersion: 'v8',
      });
    });

    // Test #11: A refused valuation includes an explicit explanation for the refusal.
    it('includes the explicit reason when a valuation is refused', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation(insufficientComparableSalesFixture);

      expect(result).toMatchObject({
        status: 'refusal',
        reason: expect.stringMatching(/insufficient|weak|outlier|evidence/i),
      });
    });

    // Test #12: A material change to the comparable data produces a new valuation version.
    it('creates a new valuation version when material facts change', async () => {
      const service = new ValuationCalculationService();

      const firstResult = await service.calculateValuation(supportedComparableSalesFixture);
      const changedComparableSalesFixture = {
        ...supportedComparableSalesFixture,
        itemVersion: 'v9',
        comparables: [
          ...supportedComparableSalesFixture.comparables,
          {
            id: 'c-4',
            saleDate: '2024-01-15',
            weight: 1,
            soldPrice: 140000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-d',
          },
        ],
      } as ValuationInput;

      const secondResult = await service.calculateValuation(changedComparableSalesFixture);

      expect(firstResult.itemVersion).not.toBe(secondResult.itemVersion);
      expect(secondResult.itemVersion).toBe('v9');
    });

    // Test #13: Corrected material facts produce a recalculated valuation result.
    it('recalculates the valuation when a corrected material fact changes the comparable set', async () => {
      const service = new ValuationCalculationService();

      const before = await service.calculateValuation(supportedComparableSalesFixture);
      const after = await service.calculateValuation({
        ...supportedComparableSalesFixture,
        itemVersion: 'v10',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            weight: 1,
            soldPrice: 118000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            weight: 1,
            soldPrice: 121000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
            weight: 1,
            soldPrice: 119500,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });

      expect(before).not.toEqual(after);
      expect(after.itemVersion).toBe('v10');
    });

    // Test #14: Generating a new version does not mutate the previous valuation report.
    it('keeps the previous report version intact instead of mutating it in place', async () => {
      const service = new ValuationCalculationService();

      const initialResult = await service.calculateValuation(supportedComparableSalesFixture);
      const updatedResult = await service.calculateValuation({
        ...supportedComparableSalesFixture,
        itemVersion: 'v11',
      });

      expect(initialResult.itemVersion).toBe('v2');
      expect(updatedResult.itemVersion).toBe('v11');
      expect(initialResult).not.toEqual(updatedResult);
    });

    // Independent expected bounds from dated ILS/USD cross-rates.
    it('returns exact outward-rounded USD bounds from dated ILS prices', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation({
        itemId: 'lot-606',
        itemVersion: 'v12',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            weight: 1,
            soldPrice: 100000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            weight: 1,
            soldPrice: 110000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
            weight: 1,
            soldPrice: 120000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });

      expect(result).toMatchObject({
        status: 'supported',
        itemVersion: 'v12',
        valuationRange: {
          min: 28331,
          max: 32656,
          currency: 'USD',
        },
      });
    });

    // Test #16: The audit trail preserves every original currency in a multi-currency valuation.
    it('keeps each comparable currency in the audit trail when values come from multiple currencies', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation({
        itemId: 'lot-707',
        itemVersion: 'v13',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            weight: 1,
            soldPrice: 1000,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            weight: 1,
            soldPrice: 1100,
            currency: 'EUR',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
            weight: 1,
            soldPrice: 1200,
            currency: 'GBP',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });

      expect(result).toMatchObject({
        status: 'supported',
        itemVersion: 'v13',
        originalCurrencies: ['USD', 'EUR', 'GBP'],
        baseCurrency: 'USD',
      });
    });

    // Explicit upstream exclusions take precedence over prices and weights.
    it('refuses when upstream exclusions leave fewer than three sales', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation({
        itemId: 'lot-808',
        itemVersion: 'v14',
        excludedComparables: [{ id: 'c-3', reason: 'Expert excluded this comparable' }],
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            weight: 1,
            soldPrice: 100000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            weight: 1,
            soldPrice: 500000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
            weight: 1,
            soldPrice: 600000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });

      expect(result).toMatchObject({
        status: 'refusal',
        reason: 'insufficient_comparable_sales',
        itemVersion: 'v14',
      });
    });

    // Test #18: The result records the historical exchange-rate date used for each conversion.
    it('uses the dated FX rate attached to each sale date rather than a current market rate', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation({
        itemId: 'lot-909',
        itemVersion: 'v15',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-01-02',
            weight: 1,
            soldPrice: 1000,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-01',
            weight: 1,
            soldPrice: 1100,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-03-04',
            weight: 1,
            soldPrice: 1200,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });

      expect(result).toMatchObject({
        status: 'supported',
        itemVersion: 'v15',
        fxRatesUsed: expect.arrayContaining([
          expect.objectContaining({
            currency: 'USD',
            asOfDate: expect.any(String),
          }),
        ]),
      });
    });

    // Test #19: A later valuation version is a separate object and leaves the previous result unchanged.
    it('does not mutate a prior valuation result when a later version is generated', async () => {
      const service = new ValuationCalculationService();

      const previous = await service.calculateValuation(supportedComparableSalesFixture);
      const latest = await service.calculateValuation({
        ...supportedComparableSalesFixture,
        itemVersion: 'v16',
      });

      expect(previous.itemVersion).toBe('v2');
      expect(latest.itemVersion).toBe('v16');
      expect(previous).not.toBe(latest);
    });

    // Test #20: Equivalent normalized inputs produce identical valuation results across runs.
    it('returns the same result for equivalent currency-normalized data across repeated runs', async () => {
      const service = new ValuationCalculationService();

      const firstResult = await service.calculateValuation({
        itemId: 'lot-111',
        itemVersion: 'v17',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            weight: 1,
            soldPrice: 1000,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            weight: 1,
            soldPrice: 1100,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
            weight: 1,
            soldPrice: 1200,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });
      const secondResult = await service.calculateValuation({
        itemId: 'lot-111',
        itemVersion: 'v17',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            weight: 1,
            soldPrice: 1000,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            weight: 1,
            soldPrice: 1100,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
            weight: 1,
            soldPrice: 1200,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });

      const { reportId: firstId, ...firstEvidence } = firstResult;
      const { reportId: secondId, ...secondEvidence } = secondResult;
      expect(firstEvidence).toEqual(secondEvidence);
      expect(firstId).not.toBe(secondId);
    });

    // Test #21: A supported valuation report cannot be mutated after it is returned.
    it('returns a frozen, immutable report for a supported valuation', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation(supportedComparableSalesFixture);

      expect(Object.isFrozen(result)).toBe(true);
    });

    // Test #22: A refused valuation report cannot be mutated after it is returned.
    it('returns a frozen, immutable report for a refused valuation', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation(insufficientComparableSalesFixture);

      expect(Object.isFrozen(result)).toBe(true);
    });

    // Test #23: Nested fields inside a supported report cannot be mutated either (deep freeze).
    it('deep-freezes nested fields such as the valuation range and weights', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation(supportedComparableSalesFixture);

      expect(Object.isFrozen(result.valuationRange)).toBe(true);
      expect(Object.isFrozen(result.weights)).toBe(true);
      expect(() => {
        (result.valuationRange as { min: number }).min = 0;
      }).toThrow();
      expect(result.valuationRange?.min).not.toBe(0);
    });

    // Test #24: A missing exchange rate for a sale's currency/date refuses instead of assuming 1:1.
    it('refuses a valuation instead of treating a missing exchange rate as 1:1', async () => {
      const service = new ValuationCalculationService();

      const result = await service.calculateValuation({
        itemId: 'lot-909',
        itemVersion: 'v18',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            weight: 1,
            soldPrice: 1000,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '1999-01-01',
            weight: 1,
            soldPrice: 1100,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
            weight: 1,
            soldPrice: 1200,
            currency: 'JPY',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });

      expect(result).toMatchObject({
        status: 'refusal',
        reason: 'missing_exchange_rate_data',
        itemVersion: 'v18',
        missingExchangeRateComparableIds: ['c-3'],
      });
    });
  });
});
