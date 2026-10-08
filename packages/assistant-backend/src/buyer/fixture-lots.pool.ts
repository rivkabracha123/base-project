import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuctionLot } from '@monabid/shared';
import { buyerHistoryFixtureLots, type ItemHistoryLot } from './buyer-history-fixture-lots';

const catalogLots = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/auction-data/lots.json'), 'utf8'),
) as AuctionLot[];

/** All lots available for buyer search and sale-history (catalog + history demo). */
export function getAllBuyerFixtureLots(): ItemHistoryLot[] {
  const byId = new Map<string, ItemHistoryLot>();
  for (const lot of catalogLots) {
    byId.set(lot.id, lot);
  }
  for (const lot of buyerHistoryFixtureLots) {
    byId.set(lot.id, lot);
  }
  return [...byId.values()];
}

export function findBuyerFixtureLot(id: string): ItemHistoryLot | undefined {
  return getAllBuyerFixtureLots().find((lot) => lot.id === id);
}

export function resolveBuyerFixtureLots(ids?: { id: string }[]): ItemHistoryLot[] {
  const pool = getAllBuyerFixtureLots();
  if (!ids?.length) {
    return pool;
  }
  const idSet = new Set(ids.map((entry) => entry.id));
  return pool.filter((lot) => idSet.has(lot.id));
}
