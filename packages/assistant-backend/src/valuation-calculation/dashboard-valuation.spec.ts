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

// Synthetic browser payloads, inlined (not real auction evidence). Previously
// fixtures/valuation-dashboard/{supported,refusal}.json; kept here so schema-shape
// tests below don't depend on the on-disk fixture files.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately loose: tests below mutate these into invalid shapes.
const dashboardFixtures: Record<'supported' | 'refusal', any> = {
  supported: {
    reportId: 'synthetic-supported-report',
    comparableCount: 3,
    limitations: ['Synthetic evidence only; not an appraisal or guaranteed sale price.'],
    comparables: [
      { id: 'synthetic-sale-1', source: { label: 'Synthetic auction house', url: 'https://example.com/lots/1' },
        saleDate: '2024-03-10', originalPrice: 800, originalCurrency: 'USD', normalizedPrice: 800, weight: 0.5 },
      { id: 'synthetic-sale-2', source: { label: 'Synthetic auction house', url: 'https://example.com/lots/2' },
        saleDate: '2024-03-10', originalPrice: 1000, originalCurrency: 'USD', normalizedPrice: 1000, weight: 1 },
      { id: 'synthetic-sale-3', source: { label: 'Synthetic auction house', url: 'https://example.com/lots/3' },
        saleDate: '2024-03-10', originalPrice: 1200, originalCurrency: 'USD', normalizedPrice: 1200, weight: 0.5 },
    ],
    excludedComparables: [{ id: 'synthetic-outlier', reason: 'outlier' }],
    status: 'supported',
    valuationRange: { min: 858, max: 1142, currency: 'USD' },
    confidence: { level: 'low', explanation: 'Uncalibrated conservative default pending expert review.' },
  },
  refusal: {
    reportId: 'synthetic-refusal-report',
    comparableCount: 2,
    limitations: ['Synthetic evidence only; not an appraisal or guaranteed sale price.'],
    comparables: [
      { id: 'synthetic-sale-1', source: { label: 'Synthetic auction house', url: 'https://example.com/lots/1' },
        saleDate: '2024-03-10', originalPrice: 800, originalCurrency: 'USD', normalizedPrice: 800, weight: 0.5 },
      { id: 'synthetic-sale-2', source: { label: 'Synthetic auction house', url: 'https://example.com/lots/2' },
        saleDate: '2024-03-10', originalPrice: 1000, originalCurrency: 'USD', normalizedPrice: 1000, weight: 1 },
    ],
    excludedComparables: [{ id: 'synthetic-missing-fx', reason: 'missing_exchange_rate_data' }],
    status: 'refusal',
    reason: 'missing_exchange_rate_data',
  },
};
// A fresh clone per call preserves the old per-read isolation between mutating tests.
const fixture = (name: 'supported' | 'refusal') => structuredClone(dashboardFixtures[name]);

describe('S4 -> S5 snapshot -> P5 dashboard contract', () => {
  it.each(['supported', 'refusal'] as const)('accepts the synthetic %s fixture', name => {
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

  it.each([
    { name: 'HTTP URL', url: 'http://example.com/lot' },
    { name: 'URL with credentials', url: 'https://user:secret@example.com/lot' },
    { name: 'URL with query parameters', url: 'https://example.com/lot?signature=secret' },
    { name: 'URL with fragment', url: 'https://example.com/lot#secret' },
  ])('rejects $name', ({ url }) => {
    const value = fixture('supported');
    value.comparables[0].source.url = url;
    expect(dashboardValuationSchema.safeParse(value).success).toBe(false);
  });
});
