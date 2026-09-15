import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { USD_EXCHANGE_RATE_FIXTURES } from './valuation-calculation.fixtures';

export type ComparableSaleInput = {
  id: string; saleDate: string; soldPrice: number; weight: number;
  currency: string; category: string; status: 'sold' | 'unsold' | 'upcoming'; source: string;
};
export type ExcludedComparable = { id: string; reason: string };
export type ValuationInput = {
  itemId: string; itemVersion: string; comparables: ComparableSaleInput[];
  excludedComparables?: ExcludedComparable[];
};
type ComparableEvidence = {
  id: string; source: string; saleDate: string; originalPrice: number;
  originalCurrency: string; normalizedPrice: number; weight: number;
  fx: { to: 'USD'; rate: number; asOfDate: string; source: string };
};
type ValuationReportEvidence = {
  reportId: string; itemId: string; itemVersion: string; calculationVersion: string;
  comparableCount: number; baseCurrency: 'USD';
  originalCurrencies: string[];
  confidence: { level: 'low' | 'medium' | 'high'; explanation: string };
  limitations: string[]; comparables: ComparableEvidence[];
  excludedComparables: ExcludedComparable[];
  includedComparableIds: string[]; excludedComparableIds: string[];
  missingExchangeRateComparableIds: string[];
  weights: Array<{ id: string; weight: number }>;
  fxRatesUsed: Array<{ currency: string; rate: number; asOfDate: string; source: string }>;
};

// Make the existing runtime invariant explicit for backend consumers as well.
export type ValuationResult = ValuationReportEvidence & (
  | {
    status: 'supported'; reason?: never;
    valuationRange: { min: number; max: number; currency: 'USD' };
    calculation: {
      totalWeight: number; mean: number; variance: number;
      standardDeviation: number; rawMin: number; rawMax: number;
    };
  }
  | { status: 'refusal'; reason: string; valuationRange?: never; calculation?: never }
);

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

@Injectable()
export class ValuationCalculationService {
  async calculateValuation(input: ValuationInput): Promise<ValuationResult> {
    // Copy only contract fields: do not freeze caller-owned data or expose extra fields.
    const excludedComparables = (input.excludedComparables ?? []).map(({ id, reason }) => ({ id, reason }));
    const explicitlyExcluded = new Set(excludedComparables.map(entry => entry.id));
    const comparables: ComparableEvidence[] = [];
    const missingExchangeRateComparableIds: string[] = [];
    for (const sale of input.comparables) {
      if (explicitlyExcluded.has(sale.id)) continue;
      let reason: string | undefined;
      if (sale.status !== 'sold') reason = 'not_sold';
      else if (!Number.isFinite(sale.weight) || sale.weight < 0 || sale.weight > 1
        || !Number.isFinite(sale.soldPrice) || sale.soldPrice <= 0) reason = 'invalid_sale_data';
      else if (sale.weight === 0) reason = 'zero_weight';
      const rate = sale.currency === 'USD' ? 1 : USD_EXCHANGE_RATE_FIXTURES[sale.currency]?.[sale.saleDate];
      if (!reason && (!Number.isFinite(rate) || rate! <= 0)) {
        reason = 'missing_exchange_rate_data';
        missingExchangeRateComparableIds.push(sale.id);
      }
      const normalizedPrice = sale.soldPrice * (rate ?? 0);
      if (!reason && (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0)) reason = 'invalid_normalized_price';
      if (reason) {
        excludedComparables.push({ id: sale.id, reason });
        continue;
      }
      comparables.push({
        id: sale.id, source: sale.source, saleDate: sale.saleDate,
        originalPrice: sale.soldPrice, originalCurrency: sale.currency,
        normalizedPrice, weight: sale.weight,
        fx: { to: 'USD', rate: rate!, asOfDate: sale.saleDate,
          source: sale.currency === 'USD' ? 'identity' : 'fixtures/exchange-rates/rates.json (ILS cross-rate)' },
      });
    }
    const common = {
      reportId: randomUUID(), itemId: input.itemId, itemVersion: input.itemVersion,
      calculationVersion: 'weighted-usd-population-sd-v1',
      baseCurrency: 'USD' as const, comparableCount: comparables.length,
      originalCurrencies: input.comparables.filter(sale => sale.status === 'sold').map(sale => sale.currency),
      comparables, excludedComparables,
      includedComparableIds: comparables.map(sale => sale.id),
      excludedComparableIds: excludedComparables.map(sale => sale.id),
      missingExchangeRateComparableIds,
      weights: comparables.map(({ id, weight }) => ({ id, weight })),
      fxRatesUsed: comparables.map(sale => ({ currency: sale.originalCurrency, ...sale.fx })),
      // Conservative, explicitly uncalibrated default; never a statistical probability.
      confidence: { level: 'low' as const,
        explanation: 'Confidence is uncalibrated; low is a conservative default pending expert review, not a probability.' },
      limitations: [
        'Historical fixture rates and supplied evidence only; no current-market or growth adjustment.',
        'Mean plus/minus population standard deviation is a descriptive range, not a confidence interval.',
        'Confidence calibration and downstream consumer integration require separate review.',
      ],
    };
    if (comparables.length < 3) {
      return deepFreeze({ ...common, status: 'refusal',
        reason: missingExchangeRateComparableIds.length ? 'missing_exchange_rate_data' : 'insufficient_comparable_sales' });
    }
    // Canonical accumulation order keeps numeric results stable under reordering.
    const ordered = [...comparables].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const totalWeight = ordered.reduce((sum, sale) => sum + sale.weight, 0);
    // Center on an observed price so identical prices retain exactly zero dispersion,
    // even when decimal weights do not sum exactly in binary floating point.
    const anchor = ordered[0]!.normalizedPrice;
    const mean = anchor + ordered.reduce((sum, sale) =>
      sum + (sale.weight / totalWeight) * (sale.normalizedPrice - anchor), 0);
    const variance = ordered.reduce((sum, sale) =>
      sum + (sale.weight / totalWeight) * (sale.normalizedPrice - mean) ** 2, 0);
    const standardDeviation = Math.sqrt(variance);
    const rawMin = mean - standardDeviation;
    const rawMax = mean + standardDeviation;
    const min = Math.floor(rawMin);
    const max = Math.ceil(rawMax);
    // Refuse rather than invent a bound or silently remove accepted comparables.
    if (![mean, variance, standardDeviation, rawMin, rawMax].every(Number.isFinite)
      || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min <= 0) {
      return deepFreeze({ ...common, status: 'refusal', reason: 'unusable_range_requires_expert_review' });
    }
    // Confidence reflects only evidence quantity and price agreement, never a statistical probability.
    // cv (coefficient of variation) is the price spread relative to the mean; lower means tighter agreement.
    const cv = standardDeviation / mean;
    const confidenceLevel: 'low' | 'medium' | 'high' =
      comparables.length >= 5 && cv <= 0.15 ? 'high'
      : comparables.length >= 4 && cv <= 0.30 ? 'medium'
      : 'low';
    const spreadPct = `${(cv * 100).toFixed(1)}%`;
    const confidenceExplanation = confidenceLevel === 'low'
      ? `Confidence is low: ${comparables.length < 4
        ? `only ${comparables.length} comparables (the required minimum)`
        : `a ${spreadPct} price spread around the mean is too wide`
      }. This reflects evidence quantity and price agreement only, not a statistical probability.`
      : `Confidence is ${confidenceLevel}: ${comparables.length} comparables with a ${spreadPct} price spread `
        + 'around the mean. This reflects evidence quantity and price agreement only, not a statistical probability.';
    return deepFreeze({ ...common, status: 'supported',
      confidence: { level: confidenceLevel, explanation: confidenceExplanation },
      calculation: { totalWeight, mean, variance, standardDeviation, rawMin, rawMax },
      valuationRange: { min, max, currency: 'USD' } });
  }
}
