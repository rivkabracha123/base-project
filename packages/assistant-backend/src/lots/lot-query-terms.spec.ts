import { splitQueryTerms } from './lot-query-terms';

describe('splitQueryTerms', () => {
  it('splits on whitespace and drops repeated words regardless of case', () => {
    expect(splitQueryTerms('  old  Map OLD ')).toEqual(['old', 'Map']);
  });

  it.each([
    ['map of jerusalem', ['map', 'jerusalem']],
    ['Map OF Jerusalem', ['Map', 'Jerusalem']],
    ['מפה של ירושלים', ['מפה', 'ירושלים']],
  ])('drops stop words from "%s"', (query: string, expected: string[]) => {
    expect(splitQueryTerms(query)).toEqual(expected);
  });

  it('drops words made only of punctuation', () => {
    expect(splitQueryTerms('Hebrew & Judaica - books')).toEqual(['Hebrew', 'Judaica', 'books']);
  });
});
