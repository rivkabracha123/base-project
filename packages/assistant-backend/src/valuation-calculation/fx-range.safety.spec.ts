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
});
