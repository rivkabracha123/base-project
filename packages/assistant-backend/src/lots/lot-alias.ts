import aliasData from './lot-aliases.json';

interface AliasEntry {
  en: string[];
  he: string[];
}

// Trims and lowercases so lookups ignore casing and surrounding whitespace;
// lowercasing is a no-op on Hebrew text, which has no case.
function normalize(value: string): string {
  return value.trim().toLowerCase();
}

const CANONICAL_TOKEN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

// Rewrites an English term's casing, spaces and hyphens into token form
// ("Old Maps" -> "old_maps"). Anything that does not end up as a valid token,
// such as Hebrew text, is left unresolved rather than guessed at.
function toCanonicalToken(value: string): string | undefined {
  const token = normalize(value).replace(/[\s-]+/g, '_');
  return CANONICAL_TOKEN.test(token) ? token : undefined;
}

// Flattens `{ token: { en, he } }` into `phrase -> token`, so a Hebrew and an
// English phrase for the same concept resolve to one canonical token.
export function buildLookup(entries: Record<string, AliasEntry>): Record<string, string> {
  const lookup: Record<string, string> = {};
  for (const [token, { en, he }] of Object.entries(entries)) {
    for (const phrase of [...en, ...he]) {
      const key = normalize(phrase);
      const existing = lookup[key];
      if (existing && existing !== token) {
        throw new Error(`Alias "${key}" maps to both ${existing} and ${token}`);
      }
      lookup[key] = token;
    }
  }
  return lookup;
}

const categoryAliases = buildLookup(aliasData.categories);
const creatorAliases = buildLookup(aliasData.creators);

export function resolveCategoryAlias(value: string): string | undefined {
  return categoryAliases[normalize(value)] ?? toCanonicalToken(value);
}

export function resolveCreatorAlias(value: string): string | undefined {
  return creatorAliases[normalize(value)] ?? toCanonicalToken(value);
}

export function resolveGeographyAlias(value: string): string | undefined {
  return toCanonicalToken(value);
}

export function resolveMediaAlias(value: string): string | undefined {
  return toCanonicalToken(value);
}

export function resolvePeriodAlias(value: string): string | undefined {
  return toCanonicalToken(value);
}
