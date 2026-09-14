// Bounded S4 safety checks. These prove the exercised service paths, not all project CI traffic.
import http = require('node:http');
import https = require('node:https');
import net = require('node:net');
import tls = require('node:tls');
import { Logger } from '@nestjs/common';
import { ValuationCalculationService } from './valuation-calculation.service';
import { input, week3Scenarios } from './fx-range.fixtures';
jest.mock('./valuation-calculation.fixtures', () => ({
  USD_EXCHANGE_RATE_FIXTURES: jest.requireActual('./fx-range.fixtures').syntheticUsdRates,
}));

describe('Week 3: deterministic and privacy-safe calculation', () => {
  afterEach(() => { jest.restoreAllMocks(); });
  it.each(['supported', 'refusal', 'missing-fx'] as const)('makes no network calls for %s', async scenario => {
    const blocked = () => { throw new Error('External calls forbidden in valuation tests'); };
    const spies = [jest.spyOn(globalThis, 'fetch').mockImplementation(blocked),
      jest.spyOn(http, 'request').mockImplementation(blocked), jest.spyOn(http, 'get').mockImplementation(blocked),
      jest.spyOn(https, 'request').mockImplementation(blocked), jest.spyOn(https, 'get').mockImplementation(blocked),
      jest.spyOn(net, 'connect').mockImplementation(blocked), jest.spyOn(tls, 'connect').mockImplementation(blocked)];
    const payload = scenario === 'supported' ? input() : scenario === 'refusal'
      ? week3Scenarios.insufficientSales() : week3Scenarios.missingRate();
    try {
      const report = await new ValuationCalculationService().calculateValuation(payload);
      expect(report.status).toBe(scenario === 'supported' ? 'supported' : 'refusal');
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally { jest.restoreAllMocks(); }
  });

  it.each([true, false])('omits unrelated synthetic sensitive fields from reports and service logs (supported=%s)', async supported => {
    const markers = ['SYNTHETIC_CONTACT_481', 'SYNTHETIC_CODE_692', 'SYNTHETIC_CREDENTIAL_753',
      'https://example.invalid/photo?signature=SYNTHETIC_SIGNATURE_814', 'SYNTHETIC_FULL_CONVERSATION_925'];
    const logs: unknown[][] = [];
    const capture = (...args: unknown[]) => { logs.push(args); };
    for (const method of ['log', 'warn', 'error', 'debug', 'info'] as const) jest.spyOn(console, method).mockImplementation(capture);
    for (const method of ['log', 'warn', 'error', 'debug', 'verbose'] as const) jest.spyOn(Logger.prototype, method).mockImplementation(capture);
    const payload = { ...(supported ? input() : week3Scenarios.insufficientSales()),
      contact: markers[0], verificationCode: markers[1], credential: markers[2], signedUrl: markers[3], conversation: markers[4] };
    const report = await new ValuationCalculationService().calculateValuation(payload);
    const output = JSON.stringify({ report, logs });
    // Boolean checks avoid dumping marker-containing artifacts on a failure.
    for (const marker of markers) expect(output.includes(marker)).toBe(false);
  });
});
