// Executes Heni's real scoring/partitioning code and the S4 service with a documented 
// TEST-ONLY mapping. This is a contract example, NOT a production S1/S3/S4 adapter. 

import { readFileSync } from 'node:fs'; 
import { resolve } from 'node:path'; 
import { auctionLotSchema, comparableEvidenceSchema, type ComparableEvidence } from '@monabid/shared'; 
import { partitionAndSort, scoreComparable } from '../comparables/comparable-score'; 
import { ValuationCalculationService } from './valuation-calculation.service'; 
import { input, type WeightedInputFixture } from './fx-range.fixtures'; 

jest.mock('./valuation-calculation.fixtures', () => ({ 
  USD_EXCHANGE_RATE_FIXTURES: jest.requireActual('./fx-range.fixtures').syntheticUsdRates, 
})); 
 
function selectedEvidence(): ComparableEvidence { 
  const fixture = JSON.parse(readFileSync(resolve(process.cwd(), '../../fixtures/auction-data/lots.json'), 'utf8')); 
  const template = auctionLotSchema.parse(fixture[0]); 

  return partitionAndSort([800, 1000, 1200, 900].map((amount, index) => { 
    const lot = auctionLotSchema.parse({ ...template, id: `contract-${index}`, category: 'furniture', 
      status: index === 3 ? 'unsold' : 'sold', saleDate: '2024-03-10', 
      realizedPrice: index === 3 ? undefined : { amount, currency: 'USD' } }); 

    return scoreComparable(lot, { category: 'furniture' }); 
  })); 
} 

// Explicit proposed boundary: Heni.score -> S4.weight; realizedPrice -> soldPrice. 
// Keep exclusions separately, since they are evidence rather than numerical inputs. 

function toRequest(evidence: ComparableEvidence): WeightedInputFixture & { 
  excludedComparables: { id: string; reason: string }[]; 
} { 
  return { 
    ...input(), 
    comparables: evidence.included.map(entry => { 
      if (!entry.lot.realizedPrice) throw new Error('Test contract requires a realized price'); 

      return { id: entry.lot.id, saleDate: entry.lot.saleDate, soldPrice: entry.lot.realizedPrice.amount, 
        currency: entry.lot.realizedPrice.currency, category: entry.lot.category, status: 'sold', 
        source: entry.lot.source.url, weight: entry.score }; 
    }), 

    excludedComparables: evidence.excluded.map(entry => ({ 
      id: entry.lot.id, reason: entry.exclusionReason! 
    })), 
  }; 
} 
 
describe('Week 3: Heni evidence contract examples', () => { 

  it('calculates using the real scored realized-sale evidence through the explicit fixture mapping', async () => { 
    const evidence = comparableEvidenceSchema.parse(selectedEvidence()); 

    expect(evidence.included).toHaveLength(3); 
    expect(evidence.excluded).toHaveLength(1); 

    const request = toRequest(evidence); 
    const report = await new ValuationCalculationService().calculateValuation(request); 

    // Heni currently gives each matching sale score=1: equal-weight range, not golden unequal-weight range. 
    expect(report).toMatchObject({ status: 'supported', comparableCount: 3, 
      valuationRange: { min: 836, max: 1164, currency: 'USD' } }); 

    expect(report.weights).toEqual(request.comparables.map(s => ({ id: s.id, weight: s.weight }))); 
  }); 
 
  it('retains Heni exclusion reasons without using excluded lots in the formula', async () => { 
    const request = toRequest(selectedEvidence()); 
    const report = await new ValuationCalculationService().calculateValuation(request); 

    expect(report.includedComparableIds).not.toContain('contract-3'); 
    expect(report).toMatchObject({ excludedComparables: request.excludedComparables }); 
  }); 
 
  it('refuses if the selected-evidence report contains only two included realized sales', async () => { 
    const evidence = selectedEvidence(); 
    const removed = evidence.included.pop()!; 

    evidence.excluded.push({ ...removed, included: false, exclusionReason: 'Synthetic expert exclusion' }); 

    const request = toRequest(evidence); 
    const report = await new ValuationCalculationService().calculateValuation(request); 

    expect(report.status).toBe('refusal'); 
    expect(report).not.toHaveProperty('valuationRange'); 
    expect(report).toMatchObject({ excludedComparables: request.excludedComparables }); 
  }); 
 
  it('does not mutate the actual scored evidence when producing a valuation', async () => { 
    const evidence = selectedEvidence(); 
    const before = JSON.parse(JSON.stringify(evidence)); 

    await new ValuationCalculationService().calculateValuation(toRequest(evidence)); 

    expect(evidence).toEqual(before); 
  }); 

  it('produces a supported report matching the downstream valuation contract', async () => { 
    const request = toRequest(selectedEvidence()); 
    const report = await new ValuationCalculationService().calculateValuation(request); 

    expect(report.status).toBe('supported'); 

    expect(report).toEqual(expect.objectContaining({ 
      reportId: expect.any(String), 
      itemId: expect.any(String), 
      itemVersion: expect.any(String), 
      calculationVersion: expect.any(String), 
      baseCurrency: 'USD', 
      originalCurrencies: expect.any(Array), 
      comparables: expect.any(Array), 
      includedComparableIds: expect.any(Array), 
      excludedComparableIds: expect.any(Array), 
      weights: expect.any(Array), 
      fxRatesUsed: expect.any(Array), 
      confidence: expect.objectContaining({ level: expect.any(String), explanation: expect.any(String) }), 
      limitations: expect.any(Array), 
      valuationRange: expect.objectContaining({ currency: 'USD' }), 
    })); 
  }); 

  it('preserves audit information when the downstream report is a refusal', async () => { 
    const evidence = selectedEvidence(); 
    const removed = evidence.included.pop()!; 

    evidence.excluded.push({ ...removed, included: false, exclusionReason: 'Synthetic expert exclusion' }); 

    const request = toRequest(evidence); 
    const report = await new ValuationCalculationService().calculateValuation(request); 

    expect(report.status).toBe('refusal'); 

    expect(report).toEqual(expect.objectContaining({ 
      reportId: expect.any(String), 
      itemId: expect.any(String), 
      itemVersion: expect.any(String), 
      calculationVersion: expect.any(String), 
      baseCurrency: 'USD', 
      originalCurrencies: expect.any(Array), 
      comparables: expect.any(Array), 
      excludedComparables: expect.any(Array), 
      confidence: expect.any(Object), 
      limitations: expect.any(Array), 
    })); 

    expect(report).not.toHaveProperty('valuationRange'); 
  }); 

}); 