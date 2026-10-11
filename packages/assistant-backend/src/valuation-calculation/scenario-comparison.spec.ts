// Week 5 TDD: scenario comparison between two valuation report revisions.
// The previous revision comes from the caller (S1 keeps it in browser storage), so both inputs are
// untrusted: they are validated, never mutated, and no free text is echoed back unprojected.
// Synthetic data only; no network, no database.

import { Logger } from '@nestjs/common';
import type { SellerLeadValuationSnapshot } from '@monabid/shared';
import { ScenarioComparisonService } from './scenario-comparison.service';
import { WITHHELD_IDENTIFIER, WITHHELD_REASON } from './privacy-projection';

const comparable = (id: string) => ({
  id, source: { label: 'Source unavailable', url: null }, saleDate: '2024-03-10',
  originalPrice: 1000, originalCurrency: 'USD', normalizedPrice: 1000, weight: 1,
});

function supported(reportId: string, itemVersion: string, min: number, max: number, itemId = 'item-1'): SellerLeadValuationSnapshot {
  return {
    itemId, itemVersion, calculationVersion: 'weighted-usd-population-sd-v1',
    dashboard: {
      status: 'supported', reportId, comparableCount: 3, limitations: ['Synthetic.'],
      comparables: [comparable('a'), comparable('b'), comparable('c')], excludedComparables: [],
      valuationRange: { min, max, currency: 'USD' }, confidence: { level: 'low', explanation: 'Synthetic.' },
    },
  };
}

function refusal(reportId: string, itemVersion: string, itemId = 'item-1', reason = 'insufficient_comparable_sales'): SellerLeadValuationSnapshot {
  return {
    itemId, itemVersion, calculationVersion: 'weighted-usd-population-sd-v1',
    dashboard: {
      status: 'refusal', reportId, reason, comparableCount: 1, limitations: ['Synthetic.'],
      comparables: [comparable('a')], excludedComparables: [],
    },
  };
}

const service = () => new ScenarioComparisonService();

describe('ScenarioComparisonService', () => {
  it('compares two supported revisions with hand-calculated differences', () => {
    const result = service().compare(supported('r1', 'v1', 900, 1100), supported('r2', 'v2', 950, 1250));

    expect(result).toMatchObject({
      status: 'compared', itemId: 'item-1',
      previous: { reportId: 'r1', itemVersion: 'v1', status: 'supported', valuationRange: { min: 900, max: 1100 } },
      current: { reportId: 'r2', itemVersion: 'v2', status: 'supported', valuationRange: { min: 950, max: 1250 } },
      change: { kind: 'range_change', minDifference: 50, maxDifference: 150, comparableCountDifference: 0 },
    });
  });

  it('retains both report ids and versions even when the range does not change', () => {
    const result = service().compare(supported('r1', 'v1', 900, 1100), supported('r2', 'v2', 900, 1100));

    expect(result).toMatchObject({ previous: { reportId: 'r1' }, current: { reportId: 'r2' },
      change: { kind: 'range_change', minDifference: 0, maxDifference: 0 } });
  });

  it.each([
    ['supported to refusal', supported('r1', 'v1', 900, 1100), refusal('r2', 'v2'), 'supported_to_refusal'],
    ['refusal to supported', refusal('r1', 'v1'), supported('r2', 'v2', 900, 1100), 'refusal_to_supported'],
    ['refusal to refusal', refusal('r1', 'v1'), refusal('r2', 'v2'), 'both_refusal'],
  ])('reports %s without inventing a numeric difference', (_name, previous, current, kind) => {
    const result = service().compare(previous, current);

    expect(result).toMatchObject({ status: 'compared', change: { kind } });
    expect(JSON.stringify(result)).not.toContain('Difference');
  });

  it('keeps the refusal reason visible so the seller sees why there is no range', () => {
    const result = service().compare(supported('r1', 'v1', 900, 1100), refusal('r2', 'v2'));

    expect(result).toMatchObject({ current: { status: 'refusal', refusalReason: 'insufficient_comparable_sales' } });
  });

  it('reports revisions of different items as incompatible instead of comparing them', () => {
    const result = service().compare(supported('r1', 'v1', 900, 1100, 'item-1'), supported('r2', 'v1', 900, 1100, 'item-2'));

    expect(result).toEqual({ status: 'incompatible', reason: 'different_item' });
  });

  it.each([
    ['null', null],
    ['a string', 'not a report'],
    ['an object missing fields', { itemId: 'item-1' }],
    ['a supported report without a range', { ...supported('r1', 'v1', 900, 1100), dashboard: { ...supported('r1', 'v1', 900, 1100).dashboard, valuationRange: undefined } }],
  ])('rejects an invalid previous revision (%s) with an explicit result', (_name, invalid) => {
    expect(service().compare(invalid, supported('r2', 'v2', 900, 1100))).toEqual({ status: 'invalid_input', invalid: 'previous' });
  });

  it('rejects an invalid current revision with an explicit result', () => {
    expect(service().compare(supported('r1', 'v1', 900, 1100), { nonsense: true })).toEqual({ status: 'invalid_input', invalid: 'current' });
  });

  it('does not mutate either input', () => {
    const previous = supported('r1', 'v1', 900, 1100);
    const current = refusal('r2', 'v2');
    const before = JSON.stringify([previous, current]);

    service().compare(previous, current);

    expect(JSON.stringify([previous, current])).toBe(before);
  });

  it('returns the same comparison for the same inputs', () => {
    const [previous, current] = [supported('r1', 'v1', 900, 1100), supported('r2', 'v2', 950, 1250)];

    expect(service().compare(previous, current)).toEqual(service().compare(previous, current));
  });

  it('returns a deeply frozen result', () => {
    const result = service().compare(supported('r1', 'v1', 900, 1100), supported('r2', 'v2', 950, 1250));

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen((result as { previous: object }).previous)).toBe(true);
  });
});

// The previous revision is read from browser storage, so any free-text field could carry
// sensitive text. None of it may reach the comparison output, logs, or console.
const MARKERS = {
  email: 'privacy-test@example.invalid',
  phoneLocal: '050-123-4567',
  phoneIntl: '+972 50 123 4567',
  otp: 'TEST-OTP-839241',
  password: 'TEST_PASSWORD_SECRET_123',
  apiKey: 'TEST_API_KEY_DO_NOT_EXPOSE_123',
  bearer: 'Bearer TEST_ACCESS_TOKEN_123',
  signedUrl: 'https://example.invalid/file?token=TEST_SIGNED_URL_SECRET',
  conversation: 'Hello, this is the seller. TEST_PRIVATE_CONVERSATION_MARKER_123 please call me back',
} as const;
const SECRET_FRAGMENTS = ['privacy-test@example', '050-123-4567', '972 50 123 4567', '839241', 'TEST_PASSWORD_SECRET_123',
  'TEST_API_KEY_DO_NOT_EXPOSE_123', 'TEST_ACCESS_TOKEN_123', 'TEST_SIGNED_URL_SECRET', 'TEST_PRIVATE_CONVERSATION_MARKER_123'];
const expectNoMarkers = (output: string) => SECRET_FRAGMENTS.forEach(fragment => expect(output).not.toContain(fragment));

describe('ScenarioComparisonService privacy', () => {
  const PLACES = ['reportId', 'itemVersion', 'refusalReason'] as const;
  const CASES = PLACES.flatMap(place => Object.entries(MARKERS).map(([category, value]) => [place, category, value] as const));

  function previousWith(place: (typeof PLACES)[number], value: string): SellerLeadValuationSnapshot {
    if (place === 'refusalReason') return refusal('r1', 'v1', 'item-1', value);
    return place === 'reportId' ? supported(value, 'v1', 900, 1100) : supported('r1', value, 900, 1100);
  }

  it.each(CASES)('does not echo %s carrying %s data', (place, _category, value) => {
    const current = place === 'refusalReason' ? refusal('r2', 'v2', 'item-1', value) : supported('r2', 'v2', 950, 1250);
    const result = service().compare(previousWith(place, value), current);

    expectNoMarkers(JSON.stringify(result));
  });

  it('replaces sensitive text with safe values and keeps ordinary values', () => {
    const result = service().compare(
      supported(MARKERS.email, MARKERS.otp, 900, 1100),
      refusal('r2', 'v2', 'item-1', MARKERS.conversation),
    );

    expect(result).toMatchObject({
      previous: { reportId: WITHHELD_IDENTIFIER, itemVersion: WITHHELD_IDENTIFIER },
      current: { reportId: 'r2', itemVersion: 'v2', refusalReason: WITHHELD_REASON },
    });
  });

  it('does not write to console or the Nest logger while comparing', () => {
    const spies = [
      jest.spyOn(console, 'log'), jest.spyOn(console, 'warn'), jest.spyOn(console, 'error'),
      jest.spyOn(Logger.prototype, 'log'), jest.spyOn(Logger.prototype, 'error'),
    ].map(spy => spy.mockImplementation(() => undefined));

    service().compare(supported(MARKERS.email, 'v1', 900, 1100), refusal('r2', 'v2', 'item-1', MARKERS.password));

    spies.forEach(spy => { expect(spy).not.toHaveBeenCalled(); spy.mockRestore(); });
  });
});
