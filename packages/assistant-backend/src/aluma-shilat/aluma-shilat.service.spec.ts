// Test file: runs and verifies the AlomaShilatService valuation logic (executed via jest).
import { AlomaShilatService, type ValuationInput } from './aluma-shilat.service';

type ComparableSale = NonNullable<ValuationInput['comparables']>[number];

const makeComparable = (overrides: Partial<ComparableSale> = {}): ComparableSale => ({
  id: 'c-1',
  saleDate: '2024-03-10',
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

describe('AlomaShilatService', () => {
  let service: AlomaShilatService;

  beforeEach(() => {
    service = new AlomaShilatService();
  });

  describe('calculateValuation', () => {
    // Test #1: The service refuses valuation when fewer than three credible sales are available.
    it('refuses a valuation when there are fewer than three credible comparable sales', async () => {
      const service = new AlomaShilatService();

      const result = await service.calculateValuation(insufficientComparableSalesFixture);

      expect(result).toMatchObject({
        status: 'refusal',
        reason: 'insufficient_comparable_sales',
        itemVersion: 'v1',
      });
    });

    // Test #2: The service supports valuation when at least three credible sales are available.
    it('supports a valuation when there are at least three credible comparable sales', async () => {
      const service = new AlomaShilatService();

      const result = await service.calculateValuation(supportedComparableSalesFixture);

      expect(result).toMatchObject({
        status: 'supported',
        itemVersion: 'v2',
        comparableCount: 3,
      });
    });

    // Test #3: The service returns the same versioned result for identical input.
    it('returns a deterministic, versioned result for the same input', async () => {
      const service = new AlomaShilatService();

      const firstResult = await service.calculateValuation(supportedComparableSalesFixture);
      const secondResult = await service.calculateValuation(supportedComparableSalesFixture);

      expect(firstResult).toEqual(secondResult);
      expect(firstResult).toMatchObject({
        status: 'supported',
        itemVersion: 'v2',
        comparableCount: 3,
      });
    });

    // Test #4: The result preserves the original currencies of comparable sales for traceability.
    it('keeps the original currencies visible for traceability in a supported valuation', async () => {
      const service = new AlomaShilatService();

      const result = await service.calculateValuation({
        itemId: 'lot-789',
        itemVersion: 'v3',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            soldPrice: 120000,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            soldPrice: 130000,
            currency: 'EUR',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
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

    // Test #5: The service converts comparable prices to ILS using dated exchange rates.
    it('converts comparable prices to ILS using their sale date exchange rates', async () => {
      const service = new AlomaShilatService();

      const result = await service.calculateValuation({
        itemId: 'lot-101',
        itemVersion: 'v4',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            soldPrice: 1000,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            soldPrice: 1200,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
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
        baseCurrency: 'ILS',
      });
    });

    // Test #6: The result contains a stable ILS valuation range derived from comparable sales.
    it('returns a stable valuation range from the weighted comparable sales', async () => {
      const service = new AlomaShilatService();

      const result = await service.calculateValuation({
        itemId: 'lot-202',
        itemVersion: 'v5',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            soldPrice: 100000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            soldPrice: 120000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
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
          currency: 'ILS',
        },
      });
    });

    // Test #7: The normalized valuation range remains identical across repeated calculations.
    it('uses the same normalized range on repeated runs', async () => {
      const service = new AlomaShilatService();

      const firstResult = await service.calculateValuation(supportedComparableSalesFixture);
      const secondResult = await service.calculateValuation(supportedComparableSalesFixture);

      expect(firstResult.valuationRange).toEqual(secondResult.valuationRange);
    });

    // Test #8: The service excludes a highly divergent comparable before calculating the range.
    it('excludes a highly divergent comparable before calculating the valuation range', async () => {
      const service = new AlomaShilatService();

      const result = await service.calculateValuation({
        itemId: 'lot-303',
        itemVersion: 'v6',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            soldPrice: 120000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            soldPrice: 119000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
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
        excludedOutliers: 1,
      });
    });

    // Test #9: The result includes a numeric confidence score for the valuation.
    it('returns a confidence score describing how reliable the valuation is', async () => {
      const service = new AlomaShilatService();

      const result = await service.calculateValuation({
        itemId: 'lot-404',
        itemVersion: 'v7',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            soldPrice: 100000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            soldPrice: 110000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
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
        confidence: expect.any(Number),
      });
    });

    // Test #10: The service refuses valuation when sufficient sales still provide weak evidence.
    it('refuses a valuation when the evidence is too weak even if there are sales', async () => {
      const service = new AlomaShilatService();

      const result = await service.calculateValuation({
        itemId: 'lot-505',
        itemVersion: 'v8',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            soldPrice: 80000,
            currency: 'ILS',
            category: 'electronics',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            soldPrice: 90000,
            currency: 'ILS',
            category: 'electronics',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
            soldPrice: 500000,
            currency: 'ILS',
            category: 'electronics',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });

      expect(result).toMatchObject({
        status: 'refusal',
        reason: 'insufficient_quality_or_outlier_pressure',
        itemVersion: 'v8',
      });
    });

    // Test #11: A refused valuation includes an explicit explanation for the refusal.
    it('includes the explicit reason when a valuation is refused', async () => {
      const service = new AlomaShilatService();

      const result = await service.calculateValuation(insufficientComparableSalesFixture);

      expect(result).toMatchObject({
        status: 'refusal',
        reason: expect.stringMatching(/insufficient|weak|outlier|evidence/i),
      });
    });

    // Test #12: A material change to the comparable data produces a new valuation version.
    it('creates a new valuation version when material facts change', async () => {
      const service = new AlomaShilatService();

      const firstResult = await service.calculateValuation(supportedComparableSalesFixture);
      const changedComparableSalesFixture = {
        ...supportedComparableSalesFixture,
        itemVersion: 'v9',
        comparables: [
          ...supportedComparableSalesFixture.comparables,
          {
            id: 'c-4',
            saleDate: '2024-01-15',
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
      const service = new AlomaShilatService();

      const before = await service.calculateValuation(supportedComparableSalesFixture);
      const after = await service.calculateValuation({
        ...supportedComparableSalesFixture,
        itemVersion: 'v10',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            soldPrice: 118000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            soldPrice: 121000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
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
      const service = new AlomaShilatService();

      const initialResult = await service.calculateValuation(supportedComparableSalesFixture);
      const updatedResult = await service.calculateValuation({
        ...supportedComparableSalesFixture,
        itemVersion: 'v11',
      });

      expect(initialResult.itemVersion).toBe('v2');
      expect(updatedResult.itemVersion).toBe('v11');
      expect(initialResult).not.toEqual(updatedResult);
    });

    // Test #15: The valuation range returns the exact minimum and maximum ILS values.
    it('returns an exact supported range with min, max, and currency in ILS', async () => {
      const service = new AlomaShilatService();

      const result = await service.calculateValuation({
        itemId: 'lot-606',
        itemVersion: 'v12',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            soldPrice: 100000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            soldPrice: 110000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
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
          min: 100000,
          max: 120000,
          currency: 'ILS',
        },
      });
    });

    // Test #16: The audit trail preserves every original currency in a multi-currency valuation.
    it('keeps each comparable currency in the audit trail when values come from multiple currencies', async () => {
      const service = new AlomaShilatService();

      const result = await service.calculateValuation({
        itemId: 'lot-707',
        itemVersion: 'v13',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            soldPrice: 1000,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            soldPrice: 1100,
            currency: 'EUR',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
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
        baseCurrency: 'ILS',
      });
    });

    // Test #17: The service refuses valuation when too few credible sales remain after outlier removal.
    it('refuses a valuation when there are not enough credible sales after excluding outliers', async () => {
      const service = new AlomaShilatService();

      const result = await service.calculateValuation({
        itemId: 'lot-808',
        itemVersion: 'v14',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            soldPrice: 100000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            soldPrice: 500000,
            currency: 'ILS',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
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
        reason: 'insufficient_quality_or_outlier_pressure',
        itemVersion: 'v14',
      });
    });

    // Test #18: The result records the historical exchange-rate date used for each conversion.
    it('uses the dated FX rate attached to each sale date rather than a current market rate', async () => {
      const service = new AlomaShilatService();

      const result = await service.calculateValuation({
        itemId: 'lot-909',
        itemVersion: 'v15',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-01-02',
            soldPrice: 1000,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-01',
            soldPrice: 1100,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-03-04',
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
      const service = new AlomaShilatService();

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
      const service = new AlomaShilatService();

      const firstResult = await service.calculateValuation({
        itemId: 'lot-111',
        itemVersion: 'v17',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            soldPrice: 1000,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            soldPrice: 1100,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
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
            soldPrice: 1000,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '2024-02-15',
            soldPrice: 1100,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
            soldPrice: 1200,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-c',
          },
        ],
      });

      expect(firstResult).toEqual(secondResult);
    });

    // Test #21: A supported valuation report cannot be mutated after it is returned.
    it('returns a frozen, immutable report for a supported valuation', async () => {
      const service = new AlomaShilatService();

      const result = await service.calculateValuation(supportedComparableSalesFixture);

      expect(Object.isFrozen(result)).toBe(true);
    });

    // Test #22: A refused valuation report cannot be mutated after it is returned.
    it('returns a frozen, immutable report for a refused valuation', async () => {
      const service = new AlomaShilatService();

      const result = await service.calculateValuation(insufficientComparableSalesFixture);

      expect(Object.isFrozen(result)).toBe(true);
    });

    // Test #23: Nested fields inside a supported report cannot be mutated either (deep freeze).
    it('deep-freezes nested fields such as the valuation range and weights', async () => {
      const service = new AlomaShilatService();

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
      const service = new AlomaShilatService();

      const result = await service.calculateValuation({
        itemId: 'lot-909',
        itemVersion: 'v18',
        comparables: [
          {
            id: 'c-1',
            saleDate: '2024-03-10',
            soldPrice: 1000,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-a',
          },
          {
            id: 'c-2',
            saleDate: '1999-01-01',
            soldPrice: 1100,
            currency: 'USD',
            category: 'furniture',
            status: 'sold',
            source: 'auction-house-b',
          },
          {
            id: 'c-3',
            saleDate: '2024-01-20',
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
        missingExchangeRateComparableIds: expect.arrayContaining(['c-2', 'c-3']),
      });
    });
  });
});
