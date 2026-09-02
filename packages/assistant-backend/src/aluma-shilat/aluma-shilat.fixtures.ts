import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Committed, dated exchange-rate fixtures supplied by the project owner in fixtures/exchange-rates/rates.json.
// Resolved from process.cwd() (the package root all npm scripts run from) so it works the same
// whether running from src (ts-jest/nest start) or from a compiled dist build (node dist/main.js).
const FIXTURE_PATH = resolve(process.cwd(), '../../fixtures/exchange-rates/rates.json');

function loadExchangeRateFixtures(): Record<string, Record<string, number>> {
  const raw: unknown = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

  if (raw === null || typeof raw !== 'object') {
    throw new Error(`Exchange-rate fixture at ${FIXTURE_PATH} must be a JSON object`);
  }

  for (const [currency, ratesByDate] of Object.entries(raw as Record<string, unknown>)) {
    if (ratesByDate === null || typeof ratesByDate !== 'object') {
      throw new Error(`Exchange-rate fixture entry for "${currency}" must be a JSON object of date -> rate`);
    }
    for (const [date, rate] of Object.entries(ratesByDate as Record<string, unknown>)) {
      if (typeof rate !== 'number') {
        throw new Error(`Exchange-rate fixture value for "${currency}" on "${date}" must be a number`);
      }
    }
  }

  return raw as Record<string, Record<string, number>>;
}

export const EXCHANGE_RATE_FIXTURES: Record<string, Record<string, number>> = loadExchangeRateFixtures();
