import { Injectable } from '@nestjs/common';
import type { AuctionLot } from '@monabid/shared';
import type { P4BuyerAiContext } from '../ai/p4-ai.types';
import { LotsService } from '../lots/lots.service';

export type ComparableSaleHistoryRequest = {
  selectedLot: { id: string; itemKey?: string };
  lots?: { id: string }[];
  language: 'he' | 'en';
};

export type ComparableSaleHistoryResponse = {
  selectedLot: AuctionLot;
  sales: AuctionLot[];
  title: string;
  summary: string;
};

@Injectable()
export class BuyerComparableSaleHistoryService {
  constructor(private readonly lots: LotsService) {}

  resolveFromP4Context(
    routeArguments: Record<string, unknown> | undefined,
    context: P4BuyerAiContext | undefined,
    language: 'he' | 'en',
  ): ComparableSaleHistoryRequest | null {
    const fromRoute = readSelectedLot(routeArguments);
    const fromContext = context?.selectedLot?.id ? context.selectedLot : null;
    const selected = fromRoute ?? fromContext;
    if (!selected?.id) {
      return null;
    }

    const lotIds = readLotIds(routeArguments) ?? context?.lots;
    return {
      selectedLot: selected,
      lots: lotIds,
      language,
    };
  }

  async getHistory(request: ComparableSaleHistoryRequest): Promise<ComparableSaleHistoryResponse> {
    const language = request.language;
    let selected = await this.lots.findOne(request.selectedLot.id);

    if (request.selectedLot.itemKey && !selected.itemKey) {
      selected = { ...selected, itemKey: request.selectedLot.itemKey };
    }

    // itemKey links separate auction records of the same item. The database is
    // the source of truth; chat never falls back to local demonstration lots.
    const sales = selected.itemKey
      ? await this.lots.findSaleHistoryByItemKey(selected.itemKey)
      : [];

    const title = language === 'he' ? 'היסטוריית מכירות של אותו פריט' : 'Sale history for this item';
    const summary =
      sales.length === 0
        ? language === 'he'
          ? 'לא נמצאו מכירות קודמות של אותו פריט בנתונים שיש לנו.'
          : 'No prior sales of this item were found in the data we have.'
        : language === 'he'
          ? `מצאנו ${sales.length} מכירות קודמות של אותו פריט.`
          : `Found ${sales.length} prior sales of this item.`;

    return { selectedLot: selected, sales, title, summary };
  }
}

function readSelectedLot(args: Record<string, unknown> | undefined): { id: string; itemKey?: string } | null {
  if (!args?.selectedLot || typeof args.selectedLot !== 'object') {
    return null;
  }
  const lot = args.selectedLot as Record<string, unknown>;
  if (typeof lot.id !== 'string' || !lot.id.trim()) {
    return null;
  }
  return {
    id: lot.id.trim(),
    itemKey: typeof lot.itemKey === 'string' ? lot.itemKey : undefined,
  };
}

function readLotIds(args: Record<string, unknown> | undefined): { id: string }[] | undefined {
  if (!Array.isArray(args?.lots)) {
    return undefined;
  }
  return args.lots
    .filter((entry): entry is { id: string } => Boolean(entry && typeof entry === 'object' && typeof (entry as { id?: string }).id === 'string'))
    .map((entry) => ({ id: entry.id }));
}
