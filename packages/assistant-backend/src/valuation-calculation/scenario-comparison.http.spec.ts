// Week 5 TDD: the HTTP entry point for scenario comparison. S1 sends the previous revision (read from
// browser storage) and the current one. Real Nest app, real controller, loopback only; synthetic data.

import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Writable } from 'node:stream';
import pinoHttp from 'pino-http';
import type { SellerLeadValuationSnapshot } from '@monabid/shared';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { httpLoggingOptions } from '../common/http-logging';
import { ValuationCalculationModule } from './valuation-calculation.module';

const comparable = (id: string) => ({
  id, source: { label: 'Source unavailable', url: null }, saleDate: '2024-03-10',
  originalPrice: 1000, originalCurrency: 'USD', normalizedPrice: 1000, weight: 1,
});

const supported = (reportId: string, itemVersion: string, min: number, max: number): SellerLeadValuationSnapshot => ({
  itemId: 'item-1', itemVersion, calculationVersion: 'weighted-usd-population-sd-v1',
  dashboard: {
    status: 'supported', reportId, comparableCount: 3, limitations: ['Synthetic.'],
    comparables: [comparable('a'), comparable('b'), comparable('c')], excludedComparables: [],
    valuationRange: { min, max, currency: 'USD' }, confidence: { level: 'low', explanation: 'Synthetic.' },
  },
});

const refusal = (reportId: string, itemVersion: string, reason = 'insufficient_comparable_sales'): SellerLeadValuationSnapshot => ({
  itemId: 'item-1', itemVersion, calculationVersion: 'weighted-usd-population-sd-v1',
  dashboard: { status: 'refusal', reportId, reason, comparableCount: 1, limitations: ['Synthetic.'],
    comparables: [comparable('a')], excludedComparables: [] },
});

const SECRET_FRAGMENTS = ['privacy-test@example', '050-123-4567', '839241', 'TEST_PASSWORD_SECRET_123',
  'TEST_ACCESS_TOKEN_123', 'TEST_SIGNED_URL_SECRET', 'TEST_PRIVATE_CONVERSATION_MARKER_123'];

describe('POST /api/valuation-calculation/comparison', () => {
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
  });

  afterEach(() => { spies.splice(0).forEach(spy => spy.mockRestore()); });
  afterAll(async () => { await app.close(); });

  const post = (body: unknown) => fetch(`${url}/api/valuation-calculation/comparison`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

  it('compares two supported revisions and answers 200 with the explicit result', async () => {
    const response = await post({ previous: supported('r1', 'v1', 900, 1100), current: supported('r2', 'v2', 950, 1250) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'compared', previous: { reportId: 'r1' }, current: { reportId: 'r2' },
      change: { kind: 'range_change', minDifference: 50, maxDifference: 150 },
    });
  });

  it('answers supported to refusal without any numeric difference', async () => {
    const response = await post({ previous: supported('r1', 'v1', 900, 1100), current: refusal('r2', 'v2') });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ change: { kind: 'supported_to_refusal' } });
    expect(JSON.stringify(body)).not.toContain('Difference');
  });

  it('answers an explicit invalid_input result naming the invalid side', async () => {
    const response = await post({ previous: { nonsense: true }, current: supported('r2', 'v2', 950, 1250) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'invalid_input', invalid: 'previous' });
  });

  it.each([
    ['previous is missing', { current: supported('r2', 'v2', 950, 1250) }],
    ['current is not an object', { previous: supported('r1', 'v1', 900, 1100), current: 'text' }],
    ['an unknown field is present', { previous: supported('r1', 'v1', 900, 1100), current: supported('r2', 'v2', 950, 1250), extra: 1 }],
    ['the body is empty', {}],
  ])('rejects the request with 400 when %s', async (_name, body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
  });

  it('does not echo sensitive text from the untrusted previous revision, and logs none of it', async () => {
    const dirty = refusal('privacy-test@example.invalid', 'TEST-OTP-839241', 'TEST_PASSWORD_SECRET_123 and Bearer TEST_ACCESS_TOKEN_123');
    dirty.dashboard.limitations = ['050-123-4567 https://example.invalid/file?token=TEST_SIGNED_URL_SECRET TEST_PRIVATE_CONVERSATION_MARKER_123'];

    const response = await post({ previous: dirty, current: supported('r2', 'v2', 950, 1250) });
    const text = await response.text();

    expect(response.status).toBe(200);
    for (const fragment of SECRET_FRAGMENTS) {
      expect(text).not.toContain(fragment);
      expect(captured.join('\n')).not.toContain(fragment);
      expect(logLines.join('')).not.toContain(fragment);
    }
    expect(logLines.length).toBeGreaterThan(0);
  });

  it('stores nothing: the same request twice gives the same answer', async () => {
    const body = { previous: supported('r1', 'v1', 900, 1100), current: supported('r2', 'v2', 950, 1250) };

    expect(await (await post(body)).json()).toEqual(await (await post(body)).json());
  });
});
