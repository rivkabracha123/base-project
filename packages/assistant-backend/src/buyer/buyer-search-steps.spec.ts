import { emptyBuyerCriteria, type BuyerCriteria } from './buyer-criteria';
import { archiveStepText, searchingStepText, unfilteredStepText, upcomingStepText } from './buyer-search-steps';

const criteria = (language: 'he' | 'en', overrides: Partial<BuyerCriteria>): BuyerCriteria => ({
  ...emptyBuyerCriteria(language),
  ...overrides,
});

describe('buyer search step texts', () => {
  it('says it is searching, without listing the details', () => {
    expect(searchingStepText(criteria('he', { categories: ['rare_books'], price: { max: 1300, currency: 'USD' } }))).toBe('מחפש…');
    expect(searchingStepText(criteria('en', {}))).toBe('Searching…');
  });

  it('tells the buyer which requested details were not filtered, and nothing when all were', () => {
    expect(unfilteredStepText(criteria('he', { periods: ['המאה ה-19'], geography: ['ירושלים'] }))).toBe(
      'שימו לב: לא ניתן לסנן לפי תקופה, מיקום, לכן התוצאות לא הוגבלו לפי זה.',
    );
    expect(unfilteredStepText(criteria('en', { periods: ['19th'] }))).toBeUndefined();
  });

  it('counts upcoming lots and past sales in both languages', () => {
    expect(upcomingStepText(2, 'en')).toBe('Found 2 similar lots in upcoming sales');
    expect(archiveStepText(3, 'he')).toBe('נמצאו 3 פריטים דומים בארכיון מכירות קודמות');
  });
});
