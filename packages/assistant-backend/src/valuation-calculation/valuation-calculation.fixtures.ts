// Reads the external exchange-rate JSON, validates its structure, and exposes it as EXCHANGE_RATE_FIXTURES once at app startup.
import { readFileSync } from 'node:fs';
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
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Exchange-rate fixture at ${FIXTURE_PATH} must be a JSON object`);
  }

  // 3. Walk every currency/date entry and confirm each rate is actually a number.
  for (const [currency, ratesByDate] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[A-Z]{3}$/.test(currency) || ratesByDate === null || typeof ratesByDate !== 'object' || Array.isArray(ratesByDate)) {
      throw new Error(`Exchange-rate fixture entry for "${currency}" must be a JSON object of date -> rate`);
    }
    for (const [date, rate] of Object.entries(ratesByDate as Record<string, unknown>)) {
      const parsedDate = new Date(date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime())
        || parsedDate.toISOString().slice(0, 10) !== date) {
        throw new Error(`Invalid FX date "${date}"`);
      }
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        throw new Error(`Exchange-rate fixture value for "${currency}" on "${date}" must be a positive finite number`);
      }
    }
  }

  // Intentionally throws instead of returning partial/invalid data, so a bad fixture fails fast at startup.
  return raw as Record<string, Record<string, number>>;
}

// Runs once when this module is first imported; every caller shares the same cached object.
// This is the final, validated object the rest of the app uses.
export const EXCHANGE_RATE_FIXTURES: Record<string, Record<string, number>> = loadExchangeRateFixtures();

// Committed quotes are ILS per source unit. Cross through the same day's USD
// quote; never borrow another day's rate or round intermediate results.
export function toUsdRates(ilsRates: Record<string, Record<string, number>>): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = { ILS: {} };
  for (const [date, ilsPerUsd] of Object.entries(ilsRates.USD ?? {})) {
    result.ILS![date] = 1 / ilsPerUsd;
    for (const [currency, datedRates] of Object.entries(ilsRates)) {
      const ilsPerUnit = datedRates[date];
      if (ilsPerUnit === undefined) continue;
      const rate = ilsPerUnit / ilsPerUsd;
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid derived USD rate');
      (result[currency] ??= {})[date] = rate;
    }
    if (!Number.isFinite(result.ILS![date]) || result.ILS![date]! <= 0) throw new Error('Invalid derived ILS/USD rate');
  }
  return result;
}

export const USD_EXCHANGE_RATE_FIXTURES = toUsdRates(EXCHANGE_RATE_FIXTURES);
