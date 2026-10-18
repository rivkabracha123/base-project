import { emptyBuyerCriteria, type BuyerCriteria } from './buyer-criteria';
import { archiveStepText, searchingStepText, unfilteredStepText, upcomingStepText } from './buyer-search-steps';

const criteria = (language: 'he' | 'en', overrides: Partial<BuyerCriteria>): BuyerCriteria => ({
  ...emptyBuyerCriteria(language),
  ...overrides,
});

describe('buyer search step texts', () => {
  it('names the category in the buyer language, whichever language the buyer typed it in', () => {
    expect(searchingStepText(criteria('he', { categories: ['rare_books'] }))).toBe('מחפשים פריטים לפי קטגוריה: ספרים נדירים…');
    expect(searchingStepText(criteria('en', { categories: ['ספרים נדירים'] }))).toBe('Searching for lots by category: rare books…');
  });

  it('shows two spellings of one category once, and an unknown category as given', () => {
    expect(searchingStepText(criteria('en', { categories: ['rare_books', 'Rare Books'] }))).toBe(
      'Searching for lots by category: rare books…',
    );
    expect(searchingStepText(criteria('en', { categories: ['Old Maps'] }))).toBe('Searching for lots by category: Old Maps…');
  });

  it('writes the budget with thousands separators as a range, an upper limit or a lower limit', () => {
    const price = (min?: number, max?: number) => ({ min, max, currency: 'USD' });
    expect(searchingStepText(criteria('en', { price: price(15000, 30000) }))).toBe('Searching for lots by budget: 15,000–30,000 USD…');
    expect(searchingStepText(criteria('he', { price: price(undefined, 1300) }))).toBe('מחפשים פריטים לפי תקציב: עד 1,300 USD…');
    expect(searchingStepText(criteria('he', { price: price(2500) }))).toBe('מחפשים פריטים לפי תקציב: מ־2,500 USD…');
  });

  it('says it is searching even before any detail is known', () => {
    expect(searchingStepText(criteria('he', {}))).toBe('מחפשים פריטים…');
    expect(searchingStepText(criteria('en', {}))).toBe('Searching for lots…');
  });

  it('tells the buyer which requested details were not filtered, and nothing when all were', () => {
    expect(unfilteredStepText(criteria('he', { periods: ['המאה ה-19'], geography: ['ירושלים'] }))).toBe(
      'שימו לב: לא ניתן לסנן לפי תקופה, מיקום, לכן התוצאות לא הוגבלו לפי זה.',
    );
    expect(unfilteredStepText(criteria('en', { periods: ['19th'] }))).toBeUndefined();
  });

  it('counts upcoming lots and past sales in both languages', () => {
    expect(upcomingStepText(2, 'en')).toBe('Found 2 upcoming lots that match this request.');
    expect(archiveStepText(3, 'he')).toBe('בדקנו גם בארכיון המכירות: נמצאו 3 מכירות קודמות דומות.');
  });
});
