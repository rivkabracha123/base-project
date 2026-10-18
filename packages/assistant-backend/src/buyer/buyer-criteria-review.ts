import type { BuyerCriteria, BuyerCriteriaConversation } from './buyer-criteria';

export type BuyerCriteriaReviewResponse = {
  sessionId: string;
  summary: string;
  criteria: BuyerCriteria;
  conversation: BuyerCriteriaConversation;
};

function listPart(values: string[], language: BuyerCriteria['language'], labelEn: string, labelHe: string): string {
  if (values.length === 0) {
    return '';
  }
  const label = language === 'he' ? labelHe : labelEn;
  return `${label}: ${values.join(', ')}`;
}

/** Human-readable criteria review for B1 before search or on demand. */
export function formatBuyerCriteriaReviewSummary(
  criteria: BuyerCriteria,
  conversation: BuyerCriteriaConversation,
): string {
  const language = criteria.language;
  const parts: string[] = [];

  if (language === 'he') {
    parts.push('סיכום הבקשה לפני חיפוש:');
  } else {
    parts.push('Search criteria review:');
  }

  const categoryPart = listPart(criteria.categories, language, 'Category', 'קטגוריה');
  if (categoryPart) parts.push(categoryPart);

  if (criteria.price?.min != null || criteria.price?.max != null) {
    const min = criteria.price.min ?? '—';
    const max = criteria.price.max ?? '—';
    parts.push(language === 'he' ? `תקציב: ${min}–${max}` : `Budget: ${min}–${max}`);
  }

  const creators = listPart(criteria.creators, language, 'Creator', 'יוצר');
  if (creators) parts.push(creators);

  const periods = listPart(criteria.periods, language, 'Period', 'תקופה');
  if (periods) parts.push(periods);

  const geography = listPart(criteria.geography, language, 'Location', 'מיקום');
  if (geography) parts.push(geography);

  if (conversation.skipped.length > 0) {
    parts.push(
      language === 'he'
        ? `דילגת על: ${conversation.skipped.join(', ')}`
        : `Skipped: ${conversation.skipped.join(', ')}`,
    );
  }

  return parts.join('\n');
}

export function buildBuyerCriteriaReviewResponse(
  sessionId: string,
  criteria: BuyerCriteria,
  conversation: BuyerCriteriaConversation,
): BuyerCriteriaReviewResponse {
  return {
    sessionId,
    summary: formatBuyerCriteriaReviewSummary(criteria, conversation),
    criteria,
    conversation,
  };
}
