// Words too common to narrow a search; matched case-insensitively.
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'and', 'or', 'for', 'to', 'with', 'by',
  'של', 'את', 'על', 'עם', 'או', 'גם',
]);

const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

// Splits free text into its distinct words, keeping the first spelling of each.
export function splitQueryTerms(query: string): string[] {
  const seen = new Set<string>();
  return query.split(/\s+/).filter((word) => {
    const key = word.toLowerCase();
    if (!HAS_LETTER_OR_DIGIT.test(word) || STOP_WORDS.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
