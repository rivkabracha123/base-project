import type { AuctionLot } from '@monabid/shared';

/**
 * צורה זמנית של B4 עד ש-P1 תפרסם itemKey בתוך AuctionLot המשותף.
 * היא מרחיבה את הטיפוס לתצוגה בלבד, בלי לשנות את החוזה המשותף.
 */
export type ItemHistoryLot = AuctionLot & { itemKey?: string };

export type HistoricalSale = ItemHistoryLot & {
  realizedPrice: NonNullable<AuctionLot['realizedPrice']>;
};

// מחזיר את המטבע של מחיר המימוש, או של ההערכה אם עדיין אין מחיר מימוש.
function preferredHistoryCurrency(lot: ItemHistoryLot) {
  return lot.realizedPrice?.currency ?? lot.estimate?.low.currency;
}

/**
 * מקבל את הפריט שנפתח ואת רשימת המכירות שקיבלנו מהשרת.
 * מחזיר רק מכירות של אותו פריט, שנמכרו בפועל, עם מחיר מימוש ובמטבע אחיד — לפי סדר תאריך.
 */
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
