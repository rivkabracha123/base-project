// Week 3 acceptance: USD FX, weighted mean +/- population standard deviation,
// outward rounding, evidence threshold and immutable results. Red tests expose pending work.
import { ValuationCalculationService } from './valuation-calculation.service';
import { input, sale, week3Scenarios, reportPair, inputFromReports } from './fx-range.fixtures';
jest.mock('./valuation-calculation.fixtures', () => ({
  USD_EXCHANGE_RATE_FIXTURES: jest.requireActual('./fx-range.fixtures').syntheticUsdRates,
}));
describe('Week 3: dated currency conversion and weighted range (service)', () => {
  let service: ValuationCalculationService;
  beforeEach(() => { service = new ValuationCalculationService(); });
  it('uses the supplied similar-product weights without replacing them with equal weights', async () => {
    const reports = reportPair();
    const result = await service.calculateValuation(inputFromReports(reports));
    expect(result.weights).toEqual([
      { id: 'sale-a', weight: 0.5 },
      { id: 'sale-b', weight: 1 },
      { id: 'sale-c', weight: 0.5 },
    ]);
  });
  // One rule, with separate results for each boundary case: at least three.
  it.each([
    { count: 0, status: 'refusal' },
    { count: 1, status: 'refusal' },
    { count: 2, status: 'refusal' },
    { count: 3, status: 'supported' },
    { count: 4, status: 'supported' },
  ] as const)('requires at least three usable sales: $count sales -> $status', async ({ count, status }) => {
    const comparables = Array.from({ length: count }, (_, index) =>
      sale({ id: `threshold-sale-${index}`, soldPrice: 1000, weight: 1 }),
    );
    const result = await service.calculateValuation(input(comparables));

    expect(result).toMatchObject({ status, comparableCount: count });
    if (status === 'refusal') {
      expect(result.reason).toEqual(expect.any(String));
      expect(result.reason!.length).toBeGreaterThan(0);
      expect(result).not.toHaveProperty('valuationRange');
    } else {
      // Currency and the weighted formula are verified by the dedicated tests below.
      expect(result.valuationRange).toMatchObject({ min: 1000, max: 1000 });
      expect(result.includedComparableIds).toEqual(comparables.map(s => s.id));
    }
  });
  it('returns the hand-calculated golden range of 858 to 1142 USD', async () => {
    // Arrange: prices are already USD, so this example isolates the weighted range.
    // Keep prices and weights explicit here instead of relying on fixture defaults.
    const request = input([
      sale({ id: 'sale-a', soldPrice: 800, currency: 'USD', weight: 0.5 }),
      sale({ id: 'sale-b', soldPrice: 1000, currency: 'USD', weight: 1 }),
      sale({ id: 'sale-c', soldPrice: 1200, currency: 'USD', weight: 0.5 }),
    ]);

    // Act: exercise the actual service, not a second implementation of the formula.
    const report = await service.calculateValuation(request);

    // Assert: independent hand calculation, with total weight 2:
    // mean = (800 * 0.5 + 1000 * 1 + 1200 * 0.5) / 2 = 1000
    // variance = (0.5 * 200^2 + 1 * 0^2 + 0.5 * 200^2) / 2 = 20000
    // sd = sqrt(20000) = 141.421356...
    // floor(1000 - sd) = 858; ceil(1000 + sd) = 1142.
    expect(report.status).toBe('supported');
    expect(report.valuationRange).toEqual({
      min: 858,
      max: 1142,
      currency: 'USD',
    });
  });
  it('returns 1000 to 1000 for identical prices with unequal weights', async () => {
    const payload = input(input().comparables.map((s, i) => ({ ...s, soldPrice: 1000, weight: [0.2, 1, 0.7][i]! })));
    expect(await service.calculateValuation(payload)).toMatchObject({ valuationRange: { min: 1000, max: 1000, currency: 'USD' } });
  });
  it('changes the numerical range when only Heni weights change', async () => {
    const first = await service.calculateValuation(input());
    const second = await service.calculateValuation(input(input().comparables.map(s => ({ ...s, weight: 0.5 }))));
    expect(first.valuationRange).toEqual({ min: 858, max: 1142, currency: 'USD' });
    // Equal weights: variance=80000/3, sd=163.299316...
    expect(second.valuationRange).toEqual({ min: 836, max: 1164, currency: 'USD' });
  });

  it.each([[0.1, 0.2, 0.3], [0.1, 0.1, 0.7]])(
    'keeps identical integer prices exact with decimal weights %s, %s, %s', async (a, b, c) => {
      const weights = [a, b, c];
      const payload = input(input().comparables.map((sale, index) => ({
        ...sale, soldPrice: 1000, weight: weights[index]!,
      })));
      expect(await service.calculateValuation(payload)).toMatchObject({
        calculation: { mean: 1000, variance: 0 },
        valuationRange: { min: 1000, max: 1000, currency: 'USD' },
      });
    });
  it('preserves the range when all weights are scaled by the same factor', async () => {
    const first = await service.calculateValuation(input());
    const second = await service.calculateValuation(input(input().comparables.map(s => ({ ...s, weight: s.weight / 2 }))));
    expect(first.status).toBe('supported'); expect(second.status).toBe('supported');
    expect(second.valuationRange).toEqual(first.valuationRange);
  });
  it('is deterministic for repeated identical input', async () => {
    const first = await service.calculateValuation(input());
    const second = await service.calculateValuation(input());
    // Report IDs/timestamps may identify separate requests; numerical evidence must be stable.
    for (const key of ['status', 'itemVersion', 'valuationRange', 'weights', 'fxRatesUsed',
      'includedComparableIds', 'excludedComparableIds', 'calculation', 'calculationVersion'] as const) {
      expect(Reflect.get(second, key)).toEqual(Reflect.get(first, key));
    }
  });
  it('preserves the numerical range when sales are reordered', async () => {
    const first = await service.calculateValuation(input());
    const reversed = await service.calculateValuation(input(input().comparables.reverse()));
    expect(first.status).toBe('supported'); expect(reversed.status).toBe('supported');
    expect(reversed.valuationRange).toEqual(first.valuationRange);
  });
  it('does not round intermediate prices before outward rounding of final bounds', async () => {
    // Early rounding to cents loses the upper display bound of 1001.
    const payload = input(input().comparables.map(s => ({ ...s, soldPrice: 1000.001 })));
    expect(await service.calculateValuation(payload)).toMatchObject({ valuationRange: { min: 1000, max: 1001, currency: 'USD' } });
  });
  it('uses different historical FX rates in the numerical calculation', async () => {
    // Normalized prices=1000,1200,1000; weights=.5,.5,1; mean=1050; variance=7500.
    const payload = week3Scenarios.datedRates();
    expect(await service.calculateValuation(payload)).toMatchObject({ valuationRange: { min: 963, max: 1137, currency: 'USD' } });
  });
  it('normalizes ILS, EUR and USD to USD before weighting', async () => {
    const payload = week3Scenarios.mixedCurrencies();
    expect(await service.calculateValuation(payload)).toMatchObject({ baseCurrency: 'USD',
      valuationRange: { min: 858, max: 1142, currency: 'USD' }, originalCurrencies: ['ILS', 'EUR', 'USD'] });
  });
  it('uses identity conversion for USD without requiring a dated USD fixture', async () => {
    const payload = input(input().comparables.map(s => ({ ...s, saleDate: '1999-01-01' })));
    expect(await service.calculateValuation(payload)).toMatchObject({ status: 'supported', valuationRange: { min: 858, max: 1142, currency: 'USD' } });
  });
  it('refuses when missing FX leaves only two usable sales instead of assuming 1:1', async () => {
    const payload = week3Scenarios.missingRate();
    const result = await service.calculateValuation(payload);
    expect(result).toMatchObject({ status: 'refusal', missingExchangeRateComparableIds: ['sale-a'] });
    expect(result).not.toHaveProperty('valuationRange');
  });
  it('calculates from three usable sales when a fourth has missing FX', async () => {
    const payload = input([...input().comparables, sale({ id: 'missing-fx', currency: 'JPY' })]);
    expect(await service.calculateValuation(payload)).toMatchObject({ status: 'supported', comparableCount: 3,
      missingExchangeRateComparableIds: ['missing-fx'], valuationRange: { min: 858, max: 1142, currency: 'USD' } });
  });
  it('does not silently borrow an adjacent-date EUR rate', async () => {
    const payload = input(); payload.comparables[0] = sale({ currency: 'EUR', saleDate: '2024-03-11' });
    const result = await service.calculateValuation(payload);
    expect(result).toMatchObject({ status: 'refusal', missingExchangeRateComparableIds: ['sale-a'] });
    expect(result).not.toHaveProperty('valuationRange');
  });
  it('does not count zero-weight sales toward the three-sale minimum', async () => {
    const payload = input(); payload.comparables[0]!.weight = 0;
    const result = await service.calculateValuation(payload);
    expect(result.status).toBe('refusal'); expect(result).not.toHaveProperty('valuationRange');
  });
  it.each(['unsold', 'upcoming'] as const)('does not count %s lots as realized sales', async status => {
    const payload = input(); payload.comparables[0]!.status = status;
    const result = await service.calculateValuation(payload);
    expect(result.status).toBe('refusal'); expect(result).not.toHaveProperty('valuationRange');
  });
  it('does not mutate the input or nested comparable records', async () => {
    const payload = input(); const before = JSON.parse(JSON.stringify(payload));
    await service.calculateValuation(payload); expect(payload).toEqual(before);
  });

  it('does not shift final bounds that are already whole dollars', async () => {
    // mean=1000, variance=10000, sd=100 exactly; unlike min/max this gives 900..1100.
    const payload = input([
      sale({ soldPrice: 800, weight: 0.125 }),
      sale({ id: 'sale-b', soldPrice: 1000, weight: 0.75 }),
      sale({ id: 'sale-c', soldPrice: 1200, weight: 0.125 }),
    ]);
    expect(await service.calculateValuation(payload)).toMatchObject({
      valuationRange: { min: 900, max: 1100, currency: 'USD' },
    });
  });

  it('excludes a zero-weight fourth sale from the result and participant count', async () => {
    const payload = input([...input().comparables, sale({ id: 'zero-weight', soldPrice: 1400, weight: 0 })]);
    const result = await service.calculateValuation(payload);
    expect(result).toMatchObject({
      status: 'supported', comparableCount: 3,
      valuationRange: { min: 858, max: 1142, currency: 'USD' },
    });
    expect(result.includedComparableIds).not.toContain('zero-weight');
    expect(result.weights?.map(entry => entry.id)).not.toContain('zero-weight');
  });

  it('refuses when all supplied weights are zero without returning NaN or a range', async () => {
    const result = await service.calculateValuation(input(input().comparables.map(s => ({ ...s, weight: 0 }))));
    expect(result.status).toBe('refusal');
    expect(result).not.toHaveProperty('valuationRange');
  });

  it.each(['unsold', 'upcoming'] as const)('ignores a fourth %s lot even with a large indicative price', async status => {
    const result = await service.calculateValuation(input([
      ...input().comparables, sale({ id: 'not-realized', status, soldPrice: 1000000 }),
    ]));
    expect(result).toMatchObject({ status: 'supported', comparableCount: 3,
      valuationRange: { min: 858, max: 1142, currency: 'USD' } });
    expect(result.includedComparableIds).not.toContain('not-realized');
  });

  it('does not add speculative growth to older USD sales when prices and weights are unchanged', async () => {
    const older = input(input().comparables.map(s => ({ ...s, saleDate: '2000-01-01' })));
    const newer = input(input().comparables.map(s => ({ ...s, saleDate: '2024-03-10' })));
    const oldResult = await service.calculateValuation(older);
    const newResult = await service.calculateValuation(newer);
    expect(oldResult.status).toBe('supported');
    expect(newResult.status).toBe('supported');
    expect(oldResult.valuationRange).toEqual(newResult.valuationRange);
  });

  it('does not silently apply the old twice-the-minimum outlier rule to included sales', async () => {
    // Accepted realized sales: mean=1400, variance=980000, sd=989.94949...
    // The 2800 sale is not discarded merely because it exceeds 2 * 700.
    const result = await service.calculateValuation(input([
      sale({ soldPrice: 700, weight: 1 }),
      sale({ id: 'sale-b', soldPrice: 700, weight: 1 }),
      sale({ id: 'sale-c', soldPrice: 2800, weight: 1 }),
    ]));
    expect(result).toMatchObject({ status: 'supported', comparableCount: 3,
      valuationRange: { min: 410, max: 2390, currency: 'USD' } });
    expect(result.includedComparableIds).toEqual(['sale-a', 'sale-b', 'sale-c']);
  });

  it('never presents a non-positive range as a supported valuation under extreme dispersion', async () => {
    // The documented candidate policy is expert-review refusal. This assertion only
    // enforces the invariant; it does not invent a refusal code or confidence threshold.
    const result = await service.calculateValuation(input([
      sale({ soldPrice: 1, weight: 1 }), sale({ id: 'sale-b', soldPrice: 1, weight: 1 }),
      sale({ id: 'sale-c', soldPrice: 1000, weight: 1 }),
    ]));
    if (result.status === 'supported') {
      expect(result.valuationRange?.min).toBeGreaterThan(0);
      expect(Number.isFinite(result.valuationRange?.max)).toBe(true);
    } else {
      expect(result.reason).toEqual(expect.any(String));
      expect(result).not.toHaveProperty('valuationRange');
    }
  });


  it('refuses non-finite dispersion rather than serializing invalid numeric evidence', async () => {
    const report = await service.calculateValuation(input([
      sale({ soldPrice: 1e200 }), sale({ id: 'b', soldPrice: 2e200 }),
      sale({ id: 'c', soldPrice: 3e200 }),
    ]));
    expect(report.status).toBe('refusal');
    expect(report).not.toHaveProperty('calculation');
    expect(report).not.toHaveProperty('valuationRange');
  });
});
