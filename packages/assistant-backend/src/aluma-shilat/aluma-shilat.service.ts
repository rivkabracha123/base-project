import { Injectable } from '@nestjs/common';
import { EXCHANGE_RATE_FIXTURES } from './aluma-shilat.fixtures';

// Shape of one comparable sale accepted by calculateValuation.
export type ComparableSaleInput = {
  id: string;
  saleDate: string;
  soldPrice: number;
  currency: string;
  category: string;
  status: 'sold' | 'unsold' | 'upcoming';
  source: string;
};

// Shape of the full input passed to calculateValuation.
export type ValuationInput = {
  itemId: string;
  itemVersion: string;
  comparables: ComparableSaleInput[];
};

// Shape of the immutable report calculateValuation returns, for either a refusal or a supported result.
export type ValuationResult = {
  status: 'refusal' | 'supported';
  reason?: string;
  itemVersion: string;
  comparableCount?: number;
  valuationRange?: {
    min: number;
    max: number;
    currency: string;
  };
  originalCurrencies?: string[];
  baseCurrency?: string;
  excludedOutliers?: number;
  confidence?: number;
  fxRatesUsed?: Array<{
    currency: string;
    asOfDate: string;
  }>;
  includedComparableIds?: string[];
  excludedComparableIds?: string[];
  missingExchangeRateComparableIds?: string[];
  weights?: Array<{
    id: string;
    weight: number;
  }>;
};

// Responsible for: the ILS conversion rate used everywhere in this file.
const BASE_CURRENCY = 'ILS';

// Responsible for: looking up a dated exchange rate for one sale.
// Returns null when no dated fixture rate exists, instead of silently assuming 1:1.
const getFxRate = (currency: string, saleDate: string): number | null => {
  if (currency === BASE_CURRENCY) {
    return 1;
  }

  return EXCHANGE_RATE_FIXTURES[currency]?.[saleDate] ?? null;
};

// Responsible for: making a report fully immutable, including nested objects and arrays.
// Object.freeze is shallow; this recursively freezes nested objects and arrays too.
const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

@Injectable()
export class AlomaShilatService {
  async calculateValuation(input: ValuationInput): Promise<ValuationResult> {
    // Responsible for: keeping only sales credible enough to count as evidence.
    const credibleSales = input.comparables.filter((item) => item.status === 'sold');

    // Responsible for: refusing outright when there isn't even the minimum number of credible sales.
    if (credibleSales.length < 3) {
      return deepFreeze({
        status: 'refusal',
        reason: 'insufficient_comparable_sales',
        itemVersion: input.itemVersion,
        comparableCount: credibleSales.length,
        includedComparableIds: credibleSales.map((sale) => sale.id),
        excludedComparableIds: [],
      });
    }

    // Responsible for: attaching a dated FX rate to each sale, and separating out any that have none.
    const ratedSales = credibleSales.map((sale) => ({
      sale,
      rate: getFxRate(sale.currency, sale.saleDate),
    }));
    const missingRateSales = ratedSales.filter((item) => item.rate === null);
    const usableSales = ratedSales.filter(
      (item): item is { sale: ComparableSaleInput; rate: number } => item.rate !== null,
    );

    // Responsible for: refusing when too many sales lost their rate, leaving too little usable evidence.
    if (usableSales.length < 3) {
      return deepFreeze({
        status: 'refusal',
        reason: 'missing_exchange_rate_data',
        itemVersion: input.itemVersion,
        comparableCount: credibleSales.length,
        includedComparableIds: usableSales.map((item) => item.sale.id),
        excludedComparableIds: [],
        missingExchangeRateComparableIds: missingRateSales.map((item) => item.sale.id),
      });
    }

    // Responsible for: converting every usable sale to ILS and detecting outliers to exclude from the range.
    const normalizedSales = usableSales.map((item) => ({
      sale: item.sale,
      priceInIls: item.sale.soldPrice * item.rate,
    }));
    const prices = normalizedSales.map((item) => item.priceInIls);
    const minimumPrice = Math.min(...prices);
    const maximumPrice = Math.max(...prices);
    const outliers = normalizedSales.filter(
      (item) => item.priceInIls > minimumPrice * 2,
    );
    const retainedSales = normalizedSales.filter((item) => !outliers.includes(item));
    const hasExcessiveSpread = maximumPrice / minimumPrice >= 5;
    const hasInsufficientQuality = hasExcessiveSpread || retainedSales.length < 2;
    const originalCurrencies = credibleSales.map((sale) => sale.currency);
    const fxRatesUsed = usableSales
      .filter((item) => item.sale.currency !== BASE_CURRENCY)
      .map((item) => ({
        currency: item.sale.currency,
        asOfDate: item.sale.saleDate,
      }));

    // Responsible for: refusing when the remaining evidence is too spread out or too thin to trust.
    if (hasInsufficientQuality) {
      return deepFreeze({
        status: 'refusal',
        reason: 'insufficient_quality_or_outlier_pressure',
        itemVersion: input.itemVersion,
        comparableCount: credibleSales.length,
        originalCurrencies,
        baseCurrency: BASE_CURRENCY,
        excludedOutliers: outliers.length,
        fxRatesUsed,
        includedComparableIds: retainedSales.map((item) => item.sale.id),
        excludedComparableIds: outliers.map((item) => item.sale.id),
        missingExchangeRateComparableIds: missingRateSales.map((item) => item.sale.id),
      });
    }

    // Responsible for: computing the equal weights, the ILS range, and the confidence score for the final report.
    const retainedPrices = retainedSales.map((item) => item.priceInIls);
    const equalWeight = 1 / retainedSales.length;
    const weights = retainedSales.map((item) => ({ id: item.sale.id, weight: equalWeight }));
    const mean = retainedPrices.reduce((total, price) => total + price, 0) / retainedPrices.length;
    const variance = retainedPrices.reduce((total, price) => total + (price - mean) ** 2, 0)
      / retainedPrices.length;
    const confidence = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / mean));

    return deepFreeze({
      status: 'supported',
      itemVersion: input.itemVersion,
      comparableCount: credibleSales.length,
      originalCurrencies,
      baseCurrency: BASE_CURRENCY,
      excludedOutliers: outliers.length,
      confidence,
      fxRatesUsed,
      includedComparableIds: retainedSales.map((item) => item.sale.id),
      excludedComparableIds: outliers.map((item) => item.sale.id),
      missingExchangeRateComparableIds: missingRateSales.map((item) => item.sale.id),
      weights,
      valuationRange: {
        min: Math.min(...retainedPrices),
        max: Math.max(...retainedPrices),
        currency: BASE_CURRENCY,
      },
    });
  }

}
