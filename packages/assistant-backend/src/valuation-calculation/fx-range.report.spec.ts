// Consumer-facing assertions for the report design in the user's guide.
// New field names are the PROPOSED report contract, not an existing S5 API.
import { ValuationCalculationService } from './valuation-calculation.service';
import { input, week3Scenarios } from './fx-range.fixtures';
jest.mock('./valuation-calculation.fixtures', () => ({
  USD_EXCHANGE_RATE_FIXTURES: jest.requireActual('./fx-range.fixtures').syntheticUsdRates,
}));

describe('Week 3: reproducible valuation report', () => {
  const calculate = (payload = input()) => new ValuationCalculationService().calculateValuation(payload);
  it('records the hand-calculated mean, variance, deviation and unrounded bounds', async () => {
    const report = await calculate();
    expect(report).toMatchObject({
      calculation: {
        totalWeight: 2, mean: 1000, variance: 20000,
        standardDeviation: expect.closeTo(141.4213562373095, 9),
        rawMin: expect.closeTo(858.5786437626905, 9),
        rawMax: expect.closeTo(1141.4213562373095, 9),
      },
      valuationRange: { min: 858, max: 1142, currency: 'USD' },
    });
  });

  it('records original amounts, dated numeric FX, normalized prices and supplied weights per sale', async () => {
    const report = await calculate(week3Scenarios.mixedCurrencies());
    expect(report).toMatchObject({ comparables: [
      { id: 'sale-a', source: 'synthetic-auction-house', saleDate: '2024-03-10',
        originalPrice: 3200, originalCurrency: 'ILS', normalizedPrice: 800, weight: 0.5,
        fx: { to: 'USD', rate: 0.25, asOfDate: '2024-03-10', source: expect.any(String) } },
      { id: 'sale-b', originalPrice: 800, originalCurrency: 'EUR', normalizedPrice: 1000, weight: 1,
        fx: { to: 'USD', rate: 1.25, asOfDate: '2024-03-10', source: expect.any(String) } },
      { id: 'sale-c', originalPrice: 1200, originalCurrency: 'USD', normalizedPrice: 1200, weight: 0.5,
        fx: { to: 'USD', rate: 1, asOfDate: '2024-03-10', source: expect.any(String) } },
    ] });
  });

  it.each(['supported', 'refusal'] as const)('identifies the report, item and calculation version for %s', async status => {
    const report = await calculate(status === 'supported' ? input() : week3Scenarios.insufficientSales());
    expect(report).toMatchObject({ status, itemId: 'synthetic-item-1', itemVersion: 'v1',
      reportId: expect.stringMatching(/\S/), calculationVersion: expect.stringMatching(/\S/) });
  });

  it('serializes and deserializes the supported numerical contract without losing its values', async () => {
    const report = JSON.parse(JSON.stringify(await calculate()));
    expect(report).toMatchObject({ status: 'supported', baseCurrency: 'USD',
      valuationRange: { min: 858, max: 1142, currency: 'USD' },
      calculation: { mean: 1000, variance: 20000 },
      weights: [{ id: 'sale-a', weight: 0.5 }, { id: 'sale-b', weight: 1 }, { id: 'sale-c', weight: 0.5 }],
    });
  });

  it('serializes a refusal as a reason and evidence, without a suggested price', async () => {
    const report = JSON.parse(JSON.stringify(await calculate(week3Scenarios.insufficientSales())));
    expect(report).toMatchObject({ status: 'refusal', reason: expect.stringMatching(/\S/), comparableCount: 2 });
    for (const key of ['valuationRange', 'suggestedPrice', 'mean']) expect(report).not.toHaveProperty(key);
  });

  it('keeps the valuation revision separate from the source item revision', async () => {
    const first = await calculate();
    const changed = input(); changed.comparables[0]!.weight = 0.25;
    const second = await calculate(changed);
    expect(first.itemVersion).toBe(second.itemVersion);
    expect(first).toHaveProperty('calculationVersion');
    expect(second).toHaveProperty('calculationVersion');
    // Input item version is NOT a substitute for the version of the algorithm.
    expect(first).toHaveProperty('reportId'); expect(second).toHaveProperty('reportId');
    expect(JSON.parse(JSON.stringify(first)).reportId).not.toBe(JSON.parse(JSON.stringify(second)).reportId);
  });

  it('includes limitations without presenting standard deviation as a confidence probability', async () => {
    const report = JSON.parse(JSON.stringify(await calculate()));
    expect(Array.isArray(report.limitations)).toBe(true);
    expect(report.limitations).toEqual(expect.arrayContaining([expect.stringMatching(/\S/)]));
    // No numerical confidence threshold is invented here; the confidence method is undecided.
  });

  it('provides qualitative confidence and an explanation, without inventing numerical thresholds', async () => {
    const report = await calculate();
    expect(report).toMatchObject({ confidence: {
      level: expect.stringMatching(/^(low|medium|high)$/),
      explanation: expect.stringMatching(/\S/),
    } });
  });
});
