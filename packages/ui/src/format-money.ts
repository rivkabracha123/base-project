import type { Money } from '@monabid/shared';

export function formatMoney(money: Money, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    maximumFractionDigits: 0,
  }).format(money.amount);
}
