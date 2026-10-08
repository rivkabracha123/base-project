import { auctionLotFixtureSchema, type AuctionLot } from './auction-lot';

export type ImportReport = {
  total: number;
  accepted: number;
  rejected: number;
  duplicateIds: string[];
  validationErrors: string[];
};

export type FixtureValidation = {
  records: AuctionLot[];
  report: ImportReport;
};

export function validateAuctionLotFixture(input: unknown): FixtureValidation {
  const items = Array.isArray(input) ? input : [];
  const ids = items
    .filter((item): item is { id: string } => typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string')
    .map((item) => item.id);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  const parsed = auctionLotFixtureSchema.safeParse(input);

  if (!parsed.success || duplicateIds.length > 0) {
    return {
      records: [],
      report: {
        total: items.length,
        accepted: 0,
        rejected: Math.max(items.length, 1),
        duplicateIds,
        validationErrors: parsed.success ? [] : ['Fixture records failed canonical validation'],
      },
    };
  }

  return {
    records: parsed.data,
    report: {
      total: parsed.data.length,
      accepted: parsed.data.length,
      rejected: 0,
      duplicateIds: [],
      validationErrors: [],
    },
  };
}