import type { AuctionLot } from '@monabid/shared';

/**
 * B4's temporary presentation shape until P1 publishes itemKey on AuctionLot.
 * It deliberately extends the shared lot without modifying the shared contract.
 */
export type ItemHistoryLot = AuctionLot & { itemKey?: string };

export type HistoricalSale = ItemHistoryLot & {
  realizedPrice: NonNullable<AuctionLot['realizedPrice']>;
};

function preferredHistoryCurrency(lot: ItemHistoryLot) {
  return lot.realizedPrice?.currency ?? lot.estimate?.low.currency;
}

/** Returns chronological, source-backed sales of the same item in one currency. */
export function getComparableSaleHistory(selectedLot: ItemHistoryLot, lots: ItemHistoryLot[]): HistoricalSale[] {
  const currency = preferredHistoryCurrency(selectedLot);

  if (!selectedLot.itemKey || !currency) return [];

  return lots
    .filter((lot): lot is HistoricalSale => (
      lot.id !== selectedLot.id
      && lot.itemKey === selectedLot.itemKey
      && lot.status === 'sold'
      && lot.realizedPrice?.currency === currency
    ))
    .sort((left, right) => left.saleDate.localeCompare(right.saleDate));
}
