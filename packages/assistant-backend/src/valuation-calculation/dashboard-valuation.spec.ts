import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dashboardValuationSchema } from '@monabid/shared';
import { toSellerLeadValuationSnapshot } from './dashboard-valuation';
import { ValuationCalculationService, ValuationInput } from './valuation-calculation.service';

const input: ValuationInput = {
  itemId: 'synthetic-item', itemVersion: '1',
  comparables: [800, 1000, 1200].map((soldPrice, i) => ({
    id: `synthetic-sale-${i + 1}`, saleDate: '2024-03-10', soldPrice,
    weight: i === 1 ? 1 : 0.5, currency: 'USD', category: 'art', status: 'sold',
    source: 'https://private.example/lot?signature=secret',
  })),
};
const fixture = (name: string) => JSON.parse(readFileSync(resolve(
  __dirname, '../../../../fixtures/valuation-dashboard', `${name}.json`), 'utf8'));

describe('S4 -> S5 snapshot -> P5 dashboard contract', () => {
  it.each(['supported', 'refusal'])('accepts the synthetic %s fixture', name => {
    expect(dashboardValuationSchema.safeParse(fixture(name)).success).toBe(true);
  });

  it('projects the real supported service output without audit fields or legacy source leakage', async () => {
    const report = await new ValuationCalculationService().calculateValuation(input);
    const snapshot = toSellerLeadValuationSnapshot(report);
    expect(snapshot).toMatchObject({ itemId: input.itemId, itemVersion: '1',
      calculationVersion: report.calculationVersion,
      dashboard: { status: 'supported', valuationRange: { min: 858, max: 1142, currency: 'USD' } } });
    const dashboard = JSON.parse(JSON.stringify(snapshot.dashboard));
    expect(Object.keys(dashboard).sort()).toEqual([
      'status', 'reportId', 'comparableCount', 'limitations', 'comparables',
      'excludedComparables', 'valuationRange', 'confidence',
    ].sort());
    expect(dashboard.comparables[0].source).toEqual({ label: 'Source unavailable', url: null });
    expect(JSON.stringify(dashboard)).not.toContain('secret');
    expect(dashboard.comparables[0]).not.toHaveProperty('fx');
    snapshot.dashboard.limitations.push('snapshot-local change');
    expect(report.limitations).not.toContain('snapshot-local change');
  });

  it('retains accepted evidence and FX/external exclusions on refusal without a price range', async () => {
    const report = await new ValuationCalculationService().calculateValuation({
      ...input, comparables: input.comparables.map((sale, i) => i === 2 ? { ...sale, currency: 'ZZZ' } : sale),
      excludedComparables: [{ id: 'external-outlier', reason: 'outlier' }],
    });
    const { dashboard } = toSellerLeadValuationSnapshot(report);
    expect(dashboard).toMatchObject({ status: 'refusal', reason: 'missing_exchange_rate_data', comparableCount: 2,
      excludedComparables: [{ id: 'external-outlier', reason: 'outlier' },
        { id: 'synthetic-sale-3', reason: 'missing_exchange_rate_data' }] });
    expect(dashboard.comparables).toHaveLength(2);
    expect(dashboard).not.toHaveProperty('valuationRange');
  });

  it('rejects fake refusal ranges, leaked internals and inconsistent evidence', () => {
    expect(dashboardValuationSchema.safeParse({ ...fixture('refusal'), valuationRange: { min: 0, max: 0, currency: 'USD' } }).success).toBe(false);
    expect(dashboardValuationSchema.safeParse({ ...fixture('supported'), itemId: 'private' }).success).toBe(false);
    expect(dashboardValuationSchema.safeParse({ ...fixture('supported'), comparableCount: 99 }).success).toBe(false);
    const duplicate = fixture('supported');
    duplicate.excludedComparables.push({ id: duplicate.comparables[0].id, reason: 'outlier' });
    expect(dashboardValuationSchema.safeParse(duplicate).success).toBe(false);
  });

  it.each(['http://example.com/lot', 'https://user:secret@example.com/lot',
    'https://example.com/lot?signature=secret', 'https://example.com/lot#secret'])('rejects unsafe URL syntax: %s', url => {
    const value = fixture('supported');
    value.comparables[0].source.url = url;
    expect(dashboardValuationSchema.safeParse(value).success).toBe(false);
  });
});
