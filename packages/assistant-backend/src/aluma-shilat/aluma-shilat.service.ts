import { Injectable, NotFoundException } from '@nestjs/common';
import { EXCHANGE_RATE_FIXTURES } from './aluma-shilat.fixtures';

export type DemoLot = {
  id: string;
  title: string;
  description: string;
  category: string;
  saleDate: string;
  status: 'upcoming' | 'sold' | 'unsold';
};

export type ComparableSaleInput = {
  id: string;
  saleDate: string;
  soldPrice: number;
  currency: string;
  category: string;
  status: 'sold' | 'unsold' | 'upcoming';
  source: string;
};

export type ValuationInput = {
  itemId: string;
  itemVersion: string;
  comparables: ComparableSaleInput[];
};

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

const BASE_CURRENCY = 'ILS';

// Returns null when no dated fixture rate exists, instead of silently assuming 1:1.
const getFxRate = (currency: string, saleDate: string): number | null => {
  if (currency === BASE_CURRENCY) {
    return 1;
  }

  return EXCHANGE_RATE_FIXTURES[currency]?.[saleDate] ?? null;
};

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
  private readonly demoLots: DemoLot[] = [
    {
      id: 'demo-1',
      title: 'Demo Lot - Aloma Shilat',
      description: 'A demo lot created locally in the backend for the TDD exercise.',
      category: 'books',
      saleDate: '2026-09-01',
      status: 'upcoming',
    },
  ];

  async calculateValuation(input: ValuationInput): Promise<ValuationResult> {
    const credibleSales = input.comparables.filter((item) => item.status === 'sold');

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

    const ratedSales = credibleSales.map((sale) => ({
      sale,
      rate: getFxRate(sale.currency, sale.saleDate),
    }));
    const missingRateSales = ratedSales.filter((item) => item.rate === null);
    const usableSales = ratedSales.filter(
      (item): item is { sale: ComparableSaleInput; rate: number } => item.rate !== null,
    );

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

  async findDemoLot(): Promise<DemoLot> {
    const lot = this.demoLots[0];
    if (!lot) {
      throw new NotFoundException('No demo lots are available');
    }
    return lot;
  }

  async findDemoLotById(id: string): Promise<DemoLot> {
    const lot = this.demoLots.find((item) => item.id === id);
    if (!lot) {
      throw new NotFoundException(`Demo lot ${id} was not found`);
    }
    return lot;
  }
}
