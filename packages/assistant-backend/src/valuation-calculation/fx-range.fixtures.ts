// Week 3 test data.

import type { ComparableSaleInput, ValuationInput } from './valuation-calculation.service';

export type WeightedSaleFixture = ComparableSaleInput & { weight: number };
export type WeightedInputFixture = Omit<ValuationInput, 'comparables'> & { comparables: WeightedSaleFixture[] };

// Test FX rates.
export const syntheticUsdRates = {
  USD: {
    '2024-03-10': 1,
    '2024-02-15': 1,
    '2024-01-20': 1,
  },
  ILS: {
    '2024-03-10': 0.25,
  },
  EUR: {
    '2024-03-10': 1.25,
    '2024-02-15': 1.5,
  },
};

// Creates a comparable sale.
export function sale(overrides: Partial<WeightedSaleFixture> = {}): WeightedSaleFixture {
  return {
    id: 'sale-a',
    saleDate: '2024-03-10',
    soldPrice: 800,
    currency: 'USD',
    category: 'furniture',
    status: 'sold',
    source: 'synthetic-auction-house',
    weight: 0.5,
    ...overrides,
  };
}

// Creates valuation input.
export function input(
  comparables: WeightedSaleFixture[] = [
    sale(),
    sale({ id: 'sale-b', soldPrice: 1000, weight: 1 }),
    sale({ id: 'sale-c', soldPrice: 1200, weight: 0.5 }),
  ],
): WeightedInputFixture {
  return {
    itemId: 'synthetic-item-1',
    itemVersion: 'v1',
    comparables,
  };
}

// Simulates incoming reports.
export function reportPair(comparables?: WeightedSaleFixture[]) {
  const request = input(comparables);

  return {
    productReport: {
      itemId: request.itemId,
      itemVersion: request.itemVersion,
    },
    similarProductsReport: {
      comparables: request.comparables,
    },
  };
}

// Converts reports to service input.
export function inputFromReports(reports: ReturnType<typeof reportPair>): WeightedInputFixture {
  return {
    ...reports.productReport,
    comparables: reports.similarProductsReport.comparables,
  };
}

// Week 3 test scenarios.
export const week3Scenarios = {
  weightedUsd: (): WeightedInputFixture => input(),

  insufficientSales: (): WeightedInputFixture => input(input().comparables.slice(0, 2)),

  mixedCurrencies: (): WeightedInputFixture =>
    input([
      sale({ currency: 'ILS', soldPrice: 3200 }),
      sale({ id: 'sale-b', currency: 'EUR', soldPrice: 800, weight: 1 }),
      sale({ id: 'sale-c', soldPrice: 1200 }),
    ]),

  datedRates: (): WeightedInputFixture =>
    input([
      sale({ currency: 'EUR' }),
      sale({ id: 'sale-b', currency: 'EUR', saleDate: '2024-02-15' }),
      sale({ id: 'sale-c', soldPrice: 1000, weight: 1 }),
    ]),

  missingRate: (): WeightedInputFixture =>
    input([
      sale({ currency: 'JPY' }),
      ...input().comparables.slice(1),
    ]),
};