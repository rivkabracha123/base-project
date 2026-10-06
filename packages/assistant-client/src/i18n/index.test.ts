import { describe, expect, it } from 'vitest';
import { getBrowserLanguage } from './index';

describe('browser language selection', () => {
  it('selects Hebrew for Hebrew browser locales', () => {
    expect(getBrowserLanguage('he-IL')).toBe('he');
  });

  it('selects English for non-Hebrew browser locales', () => {
    expect(getBrowserLanguage('en-US')).toBe('en');
  });
});