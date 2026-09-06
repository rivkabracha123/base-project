// Reads the external exchange-rate JSON, validates its structure, and exposes it as EXCHANGE_RATE_FIXTURES once at app startup.
// Asynchronous function
 import { readFileSync } from 'node:fs';
// Routing
 import { resolve } from 'node:path';

// Committed, dated exchange-rate fixtures supplied by the project owner in fixtures/exchange-rates/rates.json.
// Resolved from process.cwd() (the package root all npm scripts run from) so it works the same
// whether running from src (ts-jest/nest start) or from a compiled dist build (node dist/main.js).
// Builds the exact absolute path to the fixture file.
const FIXTURE_PATH = resolve(process.cwd(), '../../fixtures/exchange-rates/rates.json');

function loadExchangeRateFixtures(): Record<string, Record<string, number>> {
  // 1. Read the file as text and parse it into a plain JavaScript value.
  const raw: unknown = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
  // 2. Confirm the top level is an object (currency -> dates), not an array, string, or null.
  if (raw === null || typeof raw !== 'object') {
    throw new Error(`Exchange-rate fixture at ${FIXTURE_PATH} must be a JSON object`);
  }

  // 3. Walk every currency/date entry and confirm each rate is actually a number.
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

  // Intentionally throws instead of returning partial/invalid data, so a bad fixture fails fast at startup.
  return raw as Record<string, Record<string, number>>;
}

// Runs once when this module is first imported; every caller shares the same cached object.
// This is the final, validated object the rest of the app uses.
export const EXCHANGE_RATE_FIXTURES: Record<string, Record<string, number>> = loadExchangeRateFixtures();
