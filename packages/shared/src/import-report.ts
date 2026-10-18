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

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/;

function containsEmailLikeContent(record: AuctionLot): boolean {
  const texts = [record.title.en, record.title.he, record.description.en, record.description.he];
  return texts.some((text) => text !== undefined && EMAIL_PATTERN.test(text));
}

export function validateAuctionLotFixture(input: unknown): FixtureValidation {
  if (!Array.isArray(input)) {
    return {
      records: [],
      report: {
        total: 0,
        accepted: 0,
        rejected: 0,
        duplicateIds: [],
        validationErrors: ['Fixture input must be an array of records'],
      },
    };
  }

  const items = input;
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

    if (containsEmailLikeContent(parsed.data)) {
      validationErrors.push('Fixture record rejected: unsafe content detected in a free-text field');
      continue;
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
