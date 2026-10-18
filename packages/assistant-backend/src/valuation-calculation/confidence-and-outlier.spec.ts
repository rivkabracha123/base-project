// Confidence rules (docs/s4-confidence-rules.pdf) and recorded outlier treatment.
// All sales are USD (identity rate), so no exchange-rate fixtures are involved.

import { ValuationCalculationService } from './valuation-calculation.service';

// Builds `count` sales with mean exactly `mean` and population standard deviation `sd`.
function spreadSales(count: number, mean: number, sd: number) {
  const offsets: Record<number, number[]> = {
    3: [-Math.sqrt(1.5), 0, Math.sqrt(1.5)],
    4: [-1, 1, -1, 1],
    5: [-2, -1, 0, 1, 2].map(v => v / Math.SQRT2),
    6: [-1, 1, -1, 1, -1, 1],
    8: [-1, 1, -1, 1, -1, 1, -1, 1],
  };
  return offsets[count]!.map((offset, index) => ({
    id: `s-${index}`, saleDate: '2024-03-10', soldPrice: mean + offset * sd, weight: 1,
    currency: 'USD', category: 'furniture', status: 'sold' as const, source: 'test',
  }));
}

const calculate = (count: number, sd: number) => new ValuationCalculationService().calculateValuation(
  { itemId: 'item', itemVersion: 'v1', comparables: spreadSales(count, 1000, sd) });

describe('confidence level from comparable count and price spread', () => {
  it.each([
    [6, 100, 'high'],                // cv 0.10
    [5, 200, 'medium'],              // cv 0.20
    [4, 250, 'medium'],              // cv 0.25
    [3, 50, 'low'],                  // count below 4
    [8, 500, 'low'],                 // cv 0.50
  ] as const)('%i sales with standard deviation %i gives %s', async (count, sd, expected) => {
    const report = await calculate(count, sd);

    expect(report.status).toBe('supported');
    expect(report.confidence.level).toBe(expected);
  });

  it('keeps the explicit not-a-probability explanation', async () => {
    const report = await calculate(6, 100);

    expect(report.confidence.explanation).toContain('not a statistical probability');
  });
});

describe('outlier treatment is recorded in the report', () => {
  it('states that no automatic outlier removal happened, in supported and refusal reports', async () => {
    const supported = await calculate(4, 250);
    const refusal = await new ValuationCalculationService().calculateValuation(
      { itemId: 'item', itemVersion: 'v1', comparables: spreadSales(3, 1000, 50).slice(0, 2) });

    for (const report of [supported, refusal]) {
      expect(report.outlierTreatment).toMatchObject({ method: 'none', removedComparableIds: [] });
      expect(report.outlierTreatment.explanation).toEqual(expect.any(String));
    }
  });

  it('does not remove an extreme price from the calculation', async () => {
    const sales = spreadSales(4, 1000, 100);
    sales[0]!.soldPrice = 40000;

    const report = await new ValuationCalculationService().calculateValuation(
      { itemId: 'item', itemVersion: 'v1', comparables: sales });

    expect(report.includedComparableIds).toContain('s-0');
    expect(report.outlierTreatment.removedComparableIds).toEqual([]);
  });
});
