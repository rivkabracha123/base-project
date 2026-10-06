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
 
  it('serializes and deserializes the supported numerical contract without losing its values', async () => { 
 
    const report = JSON.parse(JSON.stringify(await calculate())); 
 
    expect(report).toMatchObject({ status: 'supported', baseCurrency: 'USD', 
 
      valuationRange: { min: 858, max: 1142, currency: 'USD' }, 
 
      calculation: { mean: 1000, variance: 20000 }, 
 
      weights: [{ id: 'sale-a', weight: 0.5 }, { id: 'sale-b', weight: 1 }, { id: 'sale-c', weight: 0.5 }], 
 
    }); 
 
  }); 

  it('includes limitations in the valuation report', async () => { 
 
    const report = await calculate(); 
 
    expect(report.limitations).toEqual(expect.any(Array)); 
 
    expect(report.limitations.length).toBeGreaterThan(0); 
 
    report.limitations.forEach((limitation) => { 
 
      expect(typeof limitation).toBe('string'); 
 
      expect(limitation.trim().length).toBeGreaterThan(0); 
 
    }); 
 
  }); 
 
});