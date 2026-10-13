import type { AuctionLot } from '@monabid/shared';
import type { ItemHistoryLot } from './buyer-history-fixture-lots';

export type HistoricalSale = ItemHistoryLot & {
  realizedPrice: NonNullable<AuctionLot['realizedPrice']>;
};

function preferredHistoryCurrency(lot: ItemHistoryLot) {
  return lot.realizedPrice?.currency ?? lot.estimate?.low.currency;
}

/** Chronological sold lots of the same itemKey (B4 price-history contract). */
export function getComparableSaleHistory(
  selectedLot: ItemHistoryLot,
  lots: ItemHistoryLot[],
): HistoricalSale[] {
  const currency = preferredHistoryCurrency(selectedLot);

  if (!selectedLot.itemKey || !currency) {
    return [];
  }

  return lots
    .filter(
      (lot): lot is HistoricalSale =>
        lot.id !== selectedLot.id &&
        lot.itemKey === selectedLot.itemKey &&
        lot.status === 'sold' &&
        lot.realizedPrice?.currency === currency,
    )
    .sort((left, right) => left.saleDate.localeCompare(right.saleDate));
}
