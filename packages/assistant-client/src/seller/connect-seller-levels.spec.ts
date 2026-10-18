import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { getSystemText, isSellerEnquiryRequest, requestedSellerTitle } from './connect-seller-levels';

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('seller intake system messages', () => {
  it('asks the next seller question directly without verbose AI summaries', async () => {
    await i18n.changeLanguage('he');

    const message = getSystemText({
      ai: { summary: 'תודה ששיתפת את הפרטים על כתב היד העתיק.', recommendation: 'המידות עוזרות לתעד את הפריט.' },
      nextQuestion: {
        field: 'condition',
        he: 'מה מצבו של כתב היד?',
        en: 'What condition is the manuscript in?',
      },
    });

    expect(message).toBe('מה מצבו של כתב היד?');
    expect(message).not.toContain('מה סוג הפריט?');
  });

  it('shows only the concise next question when the AI has no summary', async () => {
    await i18n.changeLanguage('en');

    expect(getSystemText({
      nextQuestion: { field: 'condition', he: 'מה מצבו?', en: 'What condition is it in?' },
    })).toBe('What condition is it in?');
  });

  it('does not mix an English model summary into a Hebrew intake question', async () => {
    await i18n.changeLanguage('he');

    const message = getSystemText({
      ai: { summary: 'The item has dimensions of 80×70 and is in good condition.' },
      nextQuestion: {
        field: 'condition',
        he: 'מה מצב הפריט?',
        en: 'What condition is it in?',
      },
    });

    expect(message).toBe('מה מצב הפריט?');
    expect(message).not.toContain('The item');
  });
});

describe('seller chat command recognition', () => {
  it.each([
    'אני רוצה ליצור פניה לבית מכירות',
    'אני רוצה ליצור פנייה לבית מכירות',
    'Create an enquiry for an auction house',
  ])('recognizes an enquiry request: %s', (text) => {
    expect(isSellerEnquiryRequest(text)).toBe(true);
  });

  it.each(['לא רוצה ליצור פנייה', 'בטל את הפנייה'])('does not treat a decline as an enquiry: %s', (text) => {
    expect(isSellerEnquiryRequest(text)).toBe(false);
  });

  it.each([
    ['שנה את השם לכתב יד לבדיקה', 'כתב יד לבדיקה'],
    ['תשנה את שם הפריט לכתב יד עתיק', 'כתב יד עתיק'],
    ['Change the item name to Old manuscript', 'Old manuscript'],
  ])('extracts a corrected item name from %s', (text, title) => {
    expect(requestedSellerTitle(text)).toBe(title);
  });
});
