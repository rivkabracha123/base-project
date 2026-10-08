import { Logger } from '@nestjs/common';
import { input, week3Scenarios } from './fx-range.fixtures';
import { ValuationCalculationService } from './valuation-calculation.service';

jest.mock('./valuation-calculation.fixtures', () => ({
  USD_EXCHANGE_RATE_FIXTURES: jest.requireActual('./fx-range.fixtures').syntheticUsdRates,
}));

describe('S4 Week 4: report evidence and local privacy boundary', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([0, 1, 2])('retains honest explanation and evidence with %i accepted sales', async count => {
    const report = await new ValuationCalculationService().calculateValuation(
      input(input().comparables.slice(0, count)),
    );
    expect(report).toMatchObject({ status: 'refusal', reason: 'insufficient_comparable_sales',
      comparableCount: count, confidence: { level: 'low', explanation: expect.stringContaining('uncalibrated') } });
    expect(report.limitations.length).toBeGreaterThan(0);
    expect(report.comparables).toHaveLength(count);
    expect(report).not.toHaveProperty('valuationRange');
    expect(report).not.toHaveProperty('calculation');
    expect(Object.isFrozen(report.confidence)).toBe(true);
    expect(Object.isFrozen(report.limitations)).toBe(true);
    expect(Object.isFrozen(report.comparables)).toBe(true);
    expect(() => report.limitations.push('changed')).toThrow();
  });

  it('retains original prices and dated FX in a deeply frozen refusal report', async () => {
    const payload = week3Scenarios.mixedCurrencies();
    payload.comparables[2]!.currency = 'ZZZ';
    const report = await new ValuationCalculationService().calculateValuation(payload);
    expect(report).toMatchObject({ status: 'refusal', reason: 'missing_exchange_rate_data',
      comparables: [
        { originalPrice: 3200, originalCurrency: 'ILS', normalizedPrice: 800,
          fx: { rate: 0.25, asOfDate: '2024-03-10' } },
        { originalPrice: 800, originalCurrency: 'EUR', normalizedPrice: 1000,
          fx: { rate: 1.25, asOfDate: '2024-03-10' } },
      ], excludedComparables: [{ id: 'sale-c', reason: 'missing_exchange_rate_data' }] });
    expect(Object.isFrozen(report.comparables[0]!.fx)).toBe(true);
    expect(Object.isFrozen(report.excludedComparables[0])).toBe(true);
    expect(() => { report.comparables[0]!.fx.rate = 1; }).toThrow();
    expect(Object.isFrozen(payload.comparables[0])).toBe(false);
  });

  it.each(['supported', 'refusal'] as const)('does not log or copy undeclared input fields for %s', async status => {
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
    ];
    const base = status === 'supported' ? input() : week3Scenarios.insufficientSales();
    const marker = 'synthetic-private-field-marker';
    const payload = { ...base, contact: marker, verificationCode: marker,
      comparables: base.comparables.map(sale => ({ ...sale, privateNotes: marker })),
      excludedComparables: [{ id: 'external-exclusion', reason: 'not_sold', privateNotes: marker }],
    };
    const report = await new ValuationCalculationService().calculateValuation(payload);
    expect(report.status).toBe(status);
    expect(JSON.stringify(report).includes(marker)).toBe(false);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
