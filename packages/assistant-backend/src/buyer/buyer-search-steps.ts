import type { BuyerCriteria } from './buyer-criteria';
import { unfilteredCriteria, type ConvertedCriterion } from './criteria-to-search-request';

type Language = 'he' | 'en';

// Buyer-facing names of the searched criteria, per chat language.
const LABELS: Record<Language, Record<'categories' | 'creators' | 'keywords' | ConvertedCriterion | 'price', string>> = {
  he: { categories: 'קטגוריה', creators: 'יוצר', keywords: 'מילות חיפוש', periods: 'תקופה', geography: 'מיקום', media: 'טכניקה', price: 'תקציב' },
  en: { categories: 'category', creators: 'creator', keywords: 'keywords', periods: 'period', geography: 'location', media: 'medium', price: 'budget' },
};

// First step: tells the buyer the search started.
export function searchingStepText(criteria: BuyerCriteria): string {
  return criteria.language === 'he' ? 'מחפש…' : 'Searching…';
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
    ? `נמצאו ${count} פריטים דומים במכירות הקרובות`
    : `Found ${count} similar lots in upcoming sales`;
}

// Tells the buyer how many matching past sales the archive holds.
export function archiveStepText(count: number, language: Language): string {
  return language === 'he'
    ? `נמצאו ${count} פריטים דומים בארכיון מכירות קודמות`
    : `Found ${count} similar lots in the past sales archive`;
}
