import { auctionLotSchema, type AuctionLot } from './auction-lot';

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

function hasStringId(item: unknown): item is { id: string } {
  return typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string';
}

export function validateAuctionLotFixture(input: unknown): FixtureValidation {
  const items = Array.isArray(input) ? input : [];
  const ids = items.filter(hasStringId).map((item) => item.id);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];

  const records: AuctionLot[] = [];
  const validationErrors: string[] = [];

  for (const item of items) {
    const parsed = auctionLotSchema.safeParse(item);

    if (!parsed.success) {
      validationErrors.push('Fixture record failed canonical validation');
      continue;
    }

    if (duplicateIds.includes(parsed.data.id)) {
      continue; // duplicate id — reject every copy, we can't guess which is correct
    }

    records.push(parsed.data);
  }

  return {
    records,
    report: {
      total: items.length,
      accepted: records.length,
      rejected: items.length - records.length,
      duplicateIds,
      validationErrors,
    },
  };
}
