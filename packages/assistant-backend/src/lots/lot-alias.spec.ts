import {
  buildLookup,
  resolveCategoryAlias,
  resolveCreatorAlias,
  resolveGeographyAlias,
  resolveMediaAlias,
  resolvePeriodAlias,
} from './lot-alias';

describe('resolvePeriodAlias', () => {
  it.each(['15th century', '15TH CENTURY', '15th-century'])(
    'formats the English period "%s" as a canonical token',
    (value: string) => {
      expect(resolvePeriodAlias(value)).toBe('15th_century');
    },
  );
});

describe('resolveMediaAlias', () => {
  it.each(['Oil on Canvas', 'OIL ON CANVAS', 'oil-on-canvas'])(
    'formats the English medium "%s" as a canonical token',
    (value: string) => {
      expect(resolveMediaAlias(value)).toBe('oil_on_canvas');
    },
  );
});

describe('resolveGeographyAlias', () => {
  it.each(['Italy', 'ITALY', ' italy '])('formats the English place "%s" as a canonical token', (value: string) => {
    expect(resolveGeographyAlias(value)).toBe('italy');
  });
});

describe('buildLookup', () => {
  it('rejects a phrase that maps to two different tokens', () => {
    expect(() =>
      buildLookup({
        paintings: { en: ['paintings'], he: ['ציורים', 'אמנות'] },
        prints: { en: ['prints'], he: ['הדפסים', 'אמנות'] },
      }),
    ).toThrow(/אמנות.*paintings.*prints/);
  });
});

describe('curated alias variants', () => {
  it.each([
    ['rare book', 'rare_books'],
    ['ספר נדיר', 'rare_books'],
    ['painting', 'paintings'],
    ['ציור', 'paintings'],
  ])('resolves the category variant "%s" to %s', (value: string, token: string) => {
    expect(resolveCategoryAlias(value)).toBe(token);
  });

  it.each(['Isaac Abravanel', 'isaac abarbanel', 'Yitzhak Abravanel', 'yitzhak abarbanel', 'יצחק אברבנל'])(
    'resolves the creator variant "%s" to yitzhak_abrabanel',
    (value: string) => {
      expect(resolveCreatorAlias(value)).toBe('yitzhak_abrabanel');
    },
  );

  it.each(['לאה מזרחי', 'Leah Mizrahi'])('resolves the creator "%s" to leah_mizrahi', (value: string) => {
    expect(resolveCreatorAlias(value)).toBe('leah_mizrahi');
  });
});

describe('resolveCategoryAlias', () => {
  it('resolves a Hebrew category term to its canonical token', () => {
    expect(resolveCategoryAlias('ספרים נדירים')).toBe('rare_books');
  });

  it('resolves an English format variant to the same canonical token', () => {
    expect(resolveCategoryAlias('Rare Books')).toBe('rare_books');
  });

  it.each(['ציורים', 'Paintings'])('resolves "%s" to the paintings token', (value) => {
    expect(resolveCategoryAlias(value)).toBe('paintings');
  });

  it.each(['Old Maps', 'OLD MAPS', 'old-maps', '  old   maps '])(
    'formats the unlisted English term "%s" as a canonical token',
    (value) => {
      expect(resolveCategoryAlias(value)).toBe('old_maps');
    },
  );

  it('does not resolve when the alias phrase merely appears inside a longer string', () => {
    expect(resolveCategoryAlias('אני מחפש ספרים נדירים בעברית')).toBeUndefined();
  });

  it('does not resolve a Hebrew value with no curated alias', () => {
    expect(resolveCategoryAlias('מפות עתיקות')).toBeUndefined();
  });
});

describe('resolveCreatorAlias', () => {
  it.each(['Moshe Cohen', 'MOSHE COHEN', 'moshe-cohen', '  moshe   cohen '])(
    'formats the unlisted English name "%s" as a canonical token',
    (value) => {
      expect(resolveCreatorAlias(value)).toBe('moshe_cohen');
    },
  );

  it('resolves a Hebrew/transliterated creator name to its canonical token', () => {
    expect(resolveCreatorAlias('יצחק אברבנאל')).toBe('yitzhak_abrabanel');
  });
});
