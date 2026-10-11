import { Injectable, NotFoundException } from '@nestjs/common';
import { LotsService } from '../lots/lots.service';
import { findBuyerFixtureLot, getAllBuyerFixtureLots } from './fixture-lots.pool';
import type { ItemHistoryLot } from './buyer-history-fixture-lots';

/** Resolves lots from DB (P2) with fixture fallback for demos and history fixtures. */
@Injectable()
export class BuyerLotsResolverService {
  constructor(private readonly lots: LotsService) {}

  async findLot(id: string): Promise<ItemHistoryLot | null> {
    try {
      return await this.lots.findOne(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return findBuyerFixtureLot(id) ?? null;
      }
      throw error;
    }
  }

  async resolveLotPool(lotRefs?: { id: string }[]): Promise<ItemHistoryLot[]> {
    if (!lotRefs?.length) {
      return getAllBuyerFixtureLots();
    }

    const resolved: ItemHistoryLot[] = [];
    const seen = new Set<string>();
    for (const ref of lotRefs) {
      if (seen.has(ref.id)) continue;
      seen.add(ref.id);
      const lot = await this.findLot(ref.id);
      if (lot) resolved.push(lot);
    }

    if (resolved.length === 0) {
      return getAllBuyerFixtureLots();
    }

    for (const fixture of getAllBuyerFixtureLots()) {
      if (!seen.has(fixture.id)) {
        resolved.push(fixture);
      }
    }
    return resolved;
  }

}
