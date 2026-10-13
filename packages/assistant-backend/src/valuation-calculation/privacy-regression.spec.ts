// Week 4 privacy acceptance criterion for the valuation boundary:
// synthetic sensitive markers injected through every field that can carry external text must not
// appear in the ValuationResult (supported or refusal), the dashboard projection, HTTP output,
// errors, console/Nest logs, or HTTP request logs. Synthetic markers only; no network, no database.
//
// Scope: the S4 boundary (mapper -> calculateValuation -> report -> dashboard projection -> HTTP route).
// Not an application-wide privacy certification. An opaque identifier-shaped token cannot be told apart
// from a legitimate identifier, so it is not covered here (see docs/valuation-dashboard-handoff.md).

import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Writable } from 'node:stream';
import pinoHttp from 'pino-http';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { httpLoggingOptions } from '../common/http-logging';
import { toSellerLeadValuationSnapshot } from './dashboard-valuation';
import { ValuationCalculationModule } from './valuation-calculation.module';
import { ValuationCalculationService, type ValuationInput } from './valuation-calculation.service';
import { WITHHELD_IDENTIFIER, WITHHELD_REASON, WITHHELD_SOURCE } from './privacy-projection';

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
// The unique secret part of each marker, so partial copies are caught too.
const SECRET_FRAGMENTS = ['privacy-test@example', '050-123-4567', '972 50 123 4567', '839241',
  'TEST_PASSWORD_SECRET_123', 'TEST_API_KEY_DO_NOT_EXPOSE_123', 'TEST_ACCESS_TOKEN_123',
  'TEST_SIGNED_URL_SECRET', 'TEST_PRIVATE_CONVERSATION_MARKER_123'];

const expectNoMarkers = (output: string) => {
  for (const fragment of SECRET_FRAGMENTS) expect(output).not.toContain(fragment);
};

const sale = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, saleDate: '2024-03-10', soldPrice: 1000, weight: 1, currency: 'USD', category: 'furniture',
  status: 'sold' as const, source: 'auction-house-a', ...overrides,
});
const baseSales = () => [sale('s-1', { soldPrice: 900 }), sale('s-2'), sale('s-3', { soldPrice: 1100 }), sale('s-4')];

type Field = 'itemId' | 'itemVersion' | 'saleId' | 'source' | 'currency' | 'saleDate' | 'excludedId' | 'excludedReason';
function inputWith(field: Field, value: string): ValuationInput {
  const comparables = baseSales();
  const input: ValuationInput = { itemId: 'item-1', itemVersion: 'v1', comparables };
  if (field === 'itemId') input.itemId = value;
  else if (field === 'itemVersion') input.itemVersion = value;
  else if (field === 'saleId') comparables[0] = { ...comparables[0]!, id: value };
  else if (field === 'source') comparables[0] = { ...comparables[0]!, source: value };
  else if (field === 'currency') comparables[0] = { ...comparables[0]!, currency: value };
  else if (field === 'saleDate') comparables[0] = { ...comparables[0]!, saleDate: value };
  else if (field === 'excludedId') input.excludedComparables = [{ id: value, reason: 'expert_excluded' }];
  else input.excludedComparables = [{ id: 's-4', reason: value }];
  return input;
}

const FIELDS: Field[] = ['itemId', 'itemVersion', 'saleId', 'source', 'currency', 'saleDate', 'excludedId', 'excludedReason'];
const CASES = FIELDS.flatMap(field => Object.entries(MARKERS).map(([category, value]) => [field, category, value] as const));

describe('valuation boundary privacy: markers never reach the report or dashboard projection', () => {
  it.each(CASES)('supported report: %s carrying %s data', async (field, _category, value) => {
    const report = await new ValuationCalculationService().calculateValuation(inputWith(field, value));

    expect(report.status).toBe('supported');
    expectNoMarkers(JSON.stringify(report));
    expectNoMarkers(JSON.stringify(toSellerLeadValuationSnapshot(report)));
  });

  it.each(CASES)('refusal report: %s carrying %s data', async (field, _category, value) => {
    const input = inputWith(field, value);
    input.comparables = input.comparables.slice(0, 2);

    const report = await new ValuationCalculationService().calculateValuation(input);

    expect(report.status).toBe('refusal');
    expectNoMarkers(JSON.stringify(report));
    expectNoMarkers(JSON.stringify(toSellerLeadValuationSnapshot(report)));
  });

  it('replaces sensitive text with safe values and keeps legitimate evidence', async () => {
    const report = await new ValuationCalculationService().calculateValuation({
      itemId: MARKERS.email, itemVersion: MARKERS.otp,
      comparables: [sale('s-1', { source: MARKERS.apiKey, soldPrice: 900 }), sale('s-2'), sale('s-3', { soldPrice: 1100 }),
        sale('s-4')],
      excludedComparables: [{ id: 's-4', reason: MARKERS.conversation }],
    });

    expect(report).toMatchObject({ itemId: WITHHELD_IDENTIFIER, itemVersion: WITHHELD_IDENTIFIER, status: 'supported',
      comparableCount: 3, valuationRange: expect.objectContaining({ currency: 'USD' }) });
    expect(report.comparables[0]!.source).toBe(WITHHELD_SOURCE);
    expect(report.excludedComparables).toEqual([{ id: 's-4', reason: WITHHELD_REASON }]);
    // Ordinary evidence is preserved.
    expect(report.includedComparableIds).toEqual(['s-1', 's-2', 's-3']);
    expect(report.comparables.map(item => item.originalCurrency)).toEqual(['USD', 'USD', 'USD']);
  });

  it('keeps approved S3 exclusion reasons but drops the seller-supplied materials text', async () => {
    const report = await new ValuationCalculationService().calculateValuation({
      itemId: 'item-1', itemVersion: 'v1', comparables: baseSales().slice(0, 3),
      excludedComparables: [
        { id: 'x-1', reason: "Category does not match — 'furniture' is not 'paintings'" },
        { id: 'x-2', reason: `Similarity too weak to count as credible evidence (score 0.70 below 0.8); confirmed materials not found in listing: ${MARKERS.email}, ${MARKERS.phoneLocal}` },
      ],
    });

    expect(report.excludedComparables).toEqual([
      { id: 'x-1', reason: "Category does not match — 'furniture' is not 'paintings'" },
      { id: 'x-2', reason: 'Similarity too weak to count as credible evidence (score 0.70 below 0.8)' },
    ]);
    expectNoMarkers(JSON.stringify(report));
  });

  it('keeps real-looking identifiers from the existing data (lot ids with digit groups) unchanged', async () => {
    const report = await new ValuationCalculationService().calculateValuation({
      itemId: 'item-1', itemVersion: 'v1',
      comparables: [sale('lot-kestenbaum-54554-121421', { soldPrice: 900 }), sale('s-2'), sale('s-3', { soldPrice: 1100 })],
    });

    expect(report.includedComparableIds).toContain('lot-kestenbaum-54554-121421');
  });
});

describe('valuation boundary privacy: logs, console, HTTP and error output', () => {
  let app: INestApplication;
  let url: string;
  let logLines: string[];
  let captured: string[];
  const spies: jest.SpyInstance[] = [];

  beforeAll(async () => {
    logLines = [];
    const stream = new Writable({ write(chunk, _encoding, done) { logLines.push(chunk.toString()); done(); } });
    const moduleRef = await Test.createTestingModule({ imports: [ValuationCalculationModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(pinoHttp(httpLoggingOptions(), stream));
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });

  beforeEach(() => {
    captured = [];
    const record = (...args: unknown[]) => { captured.push(args.map(arg => JSON.stringify(arg) ?? String(arg)).join(' ')); };
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) spies.push(jest.spyOn(console, method).mockImplementation(record));
    for (const method of ['log', 'warn', 'error', 'debug', 'verbose'] as const) spies.push(jest.spyOn(Logger.prototype, method).mockImplementation(record));
    for (const method of ['log', 'warn', 'error', 'debug', 'verbose'] as const) spies.push(jest.spyOn(Logger, method).mockImplementation(record));
  });

  afterEach(() => { spies.splice(0).forEach(spy => spy.mockRestore()); });

  afterAll(async () => {
    await app.close();
  });

  // Query strings are not used by this route and are logged by shared request logging (main.ts),
  // which is outside the valuation boundary, so markers are sent in the body and headers only.
  const post = (body: unknown) => fetch(`${url}/api/valuation-calculation/valuation`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', authorization: MARKERS.bearer },
    body: JSON.stringify(body),
  });

  it('does not echo markers in the HTTP response and writes none to console, Nest logger or request logs', async () => {
    const response = await post({
      itemId: MARKERS.email, itemVersion: MARKERS.otp,
      comparables: [sale('s-1', { source: MARKERS.apiKey, soldPrice: 900 }), sale('s-2'), sale('s-3', { soldPrice: 1100 })],
      excludedComparables: [{ id: MARKERS.phoneIntl, reason: MARKERS.conversation }],
    });
    const text = await response.text();

    expect(response.status).toBe(201);
    expectNoMarkers(text);
    expectNoMarkers(captured.join('\n'));
    expectNoMarkers(logLines.join(''));
    expect(logLines.length).toBeGreaterThan(0);
  });

  it('does not echo markers in error responses or logs for an invalid request', async () => {
    const response = await post({
      itemId: MARKERS.email, itemVersion: 'v1',
      comparables: [sale('s-1', { weight: -1, source: MARKERS.password })],
    });
    const text = await response.text();

    expect(response.status).toBe(400);
    expectNoMarkers(text);
    expectNoMarkers(captured.join('\n'));
    expectNoMarkers(logLines.join(''));
  });
});
