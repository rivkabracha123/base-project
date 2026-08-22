import { describe, expect, it } from 'vitest';
import { formatMoney } from './format-money';

describe('formatMoney', () => {
  it('preserves the supplied currency', () => {
    expect(formatMoney({ amount: 1200, currency: 'USD' }, 'en-US')).toContain('$1,200');
  });
});
