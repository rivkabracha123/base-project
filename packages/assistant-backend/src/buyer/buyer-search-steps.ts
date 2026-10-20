import type { BuyerCriteria } from './buyer-criteria';
import { unfilteredCriteria, type ConvertedCriterion } from './criteria-to-search-request';

type Language = 'he' | 'en';

// Buyer-facing names of the searched criteria, per chat language.
const LABELS: Record<Language, Record<'categories' | 'creators' | 'keywords' | ConvertedCriterion | 'price', string>> = {
  he: { categories: 'קטגוריה', creators: 'יוצר', keywords: 'מילות חיפוש', periods: 'תקופה', geography: 'מיקום', media: 'טכניקה', price: 'תקציב' },
  en: { categories: 'category', creators: 'creator', keywords: 'keywords', periods: 'period', geography: 'location', media: 'medium', price: 'budget' },
};

// Describes the budget as the buyer gave it: a range, an upper limit or a lower limit.
function budgetText(price: BuyerCriteria['price'], language: Language): string | undefined {
  if (!price || (price.min == null && price.max == null)) return undefined;
  const currency = price.currency ? ` ${price.currency}` : '';
  if (price.min != null && price.max != null) return `${price.min}–${price.max}${currency}`;
  if (price.max != null) return language === 'he' ? `עד ${price.max}${currency}` : `up to ${price.max}${currency}`;
  return language === 'he' ? `מ־${price.min}${currency}` : `from ${price.min}${currency}`;
}

// First step: tells the buyer the search started and which details it searches by.
export function searchingStepText(criteria: BuyerCriteria): string {
  const language = criteria.language;
  const labels = LABELS[language];
  const parts = (['categories', 'creators', 'keywords', 'periods', 'geography', 'media'] as const)
    .filter((field) => criteria[field].length > 0)
    .map((field) => `${labels[field]}: ${criteria[field].join(', ')}`);
  const budget = budgetText(criteria.price, language);
  if (budget) parts.push(`${labels.price}: ${budget}`);
  if (parts.length === 0) return language === 'he' ? 'מחפשים פריטים…' : 'Searching for lots…';
  return language === 'he' ? `מחפשים פריטים לפי ${parts.join(' · ')}…` : `Searching for lots by ${parts.join(' · ')}…`;
}

// Tells the buyer which requested details the search could not filter by, or undefined when it filtered by all.
export function unfilteredStepText(criteria: BuyerCriteria): string | undefined {
  const fields = unfilteredCriteria(criteria);
  if (fields.length === 0) return undefined;
  const names = fields.map((field) => LABELS[criteria.language][field]).join(', ');
  return criteria.language === 'he'
    ? `שימו לב: לא ניתן לסנן לפי ${names}, לכן התוצאות לא הוגבלו לפי זה.`
    : `Note: the search cannot filter by ${names}, so results are not limited by it.`;
}

// Tells the buyer how many upcoming lots match.
export function upcomingStepText(count: number, language: Language): string {
  return language === 'he'
    ? `נמצאו ${count} פריטים קרובים למכירה שמתאימים לבקשה.`
    : `Found ${count} upcoming lots that match this request.`;
}

// Tells the buyer how many matching past sales the archive holds.
export function archiveStepText(count: number, language: Language): string {
  return language === 'he'
    ? `בדקנו גם בארכיון המכירות: נמצאו ${count} מכירות קודמות דומות.`
    : `We also checked the sales archive: ${count} similar past sales found.`;
}
