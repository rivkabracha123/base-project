import { toUsdRates, USD_EXCHANGE_RATE_FIXTURES } from './valuation-calculation.fixtures';

describe('Production dated ILS-to-USD cross-rates', () => {
  it('converts committed ILS quotes through the same day USD quote', () => {
    expect(USD_EXCHANGE_RATE_FIXTURES.ILS!['2024-03-10']).toBeCloseTo(1 / 3.61, 14);
    expect(USD_EXCHANGE_RATE_FIXTURES.EUR!['2024-02-15']).toBeCloseTo(3.84 / 3.57, 14);
    expect(USD_EXCHANGE_RATE_FIXTURES.GBP!['2024-01-20']).toBeCloseTo(4.58 / 3.64, 14);
    expect(USD_EXCHANGE_RATE_FIXTURES.USD!['2024-03-10']).toBe(1);
  });
  it('does not borrow a USD quote from another day', () => {
    const rates = toUsdRates({ USD: { '2024-03-10': 4 }, EUR: { '2024-03-11': 5 } });
    expect(rates.EUR?.['2024-03-11']).toBeUndefined();
    expect(rates.ILS?.['2024-03-11']).toBeUndefined();
  });
  it('preserves source quotes and derives exact synthetic cross-rates', () => {
    const source = { USD: { '2024-03-10': 4 }, EUR: { '2024-03-10': 5 } };
    const before = JSON.stringify(source);
    expect(toUsdRates(source)).toEqual({
      ILS: { '2024-03-10': 0.25 }, USD: { '2024-03-10': 1 }, EUR: { '2024-03-10': 1.25 },
    });
    expect(JSON.stringify(source)).toBe(before);
  });
});
