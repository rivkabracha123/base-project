import { resolveCategoryAlias, resolveCreatorAlias } from './lot-alias';

describe('resolveCategoryAlias', () => {
  it('resolves a Hebrew category term to its canonical token', () => {
    expect(resolveCategoryAlias('ספרים נדירים')).toBe('rare_books');
  });

  it('resolves an English format variant to the same canonical token', () => {
    expect(resolveCategoryAlias('Rare Books')).toBe('rare_books');
  });

  it('does not resolve when the alias phrase merely appears inside a longer string', () => {
    expect(resolveCategoryAlias('אני מחפש ספרים נדירים בעברית')).toBeUndefined();
  });

  it('does not resolve a value with no curated alias or canonical form', () => {
    expect(resolveCategoryAlias('zzz-unmapped-term')).toBeUndefined();
  });
});

describe('resolveCreatorAlias', () => {
  it('resolves a Hebrew/transliterated creator name to its canonical token', () => {
    expect(resolveCreatorAlias('יצחק אברבנאל')).toBe('yitzhak_abrabanel');
  });
});
