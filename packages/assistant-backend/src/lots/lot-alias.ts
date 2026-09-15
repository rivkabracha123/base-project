const categoryAliases: Record<string, string> = {
  'ספרים נדירים': 'rare_books',
  'rare books': 'rare_books',
  'ציורים': 'paintings',
};

const creatorAliases: Record<string, string> = {
  'יצחק אברבנאל': 'yitzhak_abrabanel',
};

// Trims and lowercases so lookups ignore casing and surrounding whitespace;
// lowercasing is a no-op on Hebrew text, which has no case.
function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveCategoryAlias(value: string): string | undefined {
  return categoryAliases[normalize(value)];
}

export function resolveCreatorAlias(value: string): string | undefined {
  return creatorAliases[normalize(value)];
}
