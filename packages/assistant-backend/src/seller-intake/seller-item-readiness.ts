import type { SellerItemDraft } from '@monabid/shared';
import { requestedSellerComparison } from '../seller-workflow/seller-comparison-action';

export function sellerComparisonCategory(category: string, description: string): string {
  return category === 'jewelry' && /\brings?\b|טבעת|טבעות/i.test(description) ? 'rings' : category;
}

export function hasSellerCondition(condition: string | undefined): boolean {
  return !!condition?.trim() && condition !== 'Not yet confirmed' && !requestedSellerComparison(condition);
}

export function sellerItemReady(item: SellerItemDraft['item']): boolean {
  return !!item.category?.trim() && item.category !== 'unknown' && !!item.dimensions?.values?.length && hasSellerCondition(item.condition);
}
