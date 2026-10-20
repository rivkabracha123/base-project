import { describe, expect, it, vi } from 'vitest';
import { soldLotFixture } from '../test/fixtures/auction-lots';
import { withBuyerSteps } from './buyer-step-updates';

describe('withBuyerSteps', () => {
  it('puts the searching and found lines before an item sale history, counting only sold lots', () => {
    const onUpdate = vi.fn();
    const history = { speaker: 'sale-history' as const, title: 'Previous sales', lots: [soldLotFixture, { ...soldLotFixture, id: 'later', status: 'upcoming' as const }] };
    withBuyerSteps(onUpdate, 'he')(history);
    expect(onUpdate.mock.calls.map(([update]) => update)).toEqual([
      { speaker: 'system', text: 'מחפש מופעים קודמים של הפריט…' },
      { speaker: 'results-found', text: 'נמצאו 1 מופעים קודמים של הפריט' },
      history,
    ]);
  });

  it('puts the comparing and found lines before a price trend', () => {
    const onUpdate = vi.fn();
    const point = { lotId: 'a', saleDate: '2026-01-01', title: 'A', price: { amount: 100, currency: 'USD' } };
    withBuyerSteps(onUpdate, 'he')({ speaker: 'price-trend', title: 'Trend', lots: [], points: [point, { ...point, lotId: 'b' }] });
    expect(onUpdate.mock.calls.slice(0, 2).map(([update]) => update.text)).toEqual(['משווה לעסקאות קודמות…', 'נמצאו 2 מחירים להשוואה']);
  });

  it('passes every other update through unchanged', () => {
    const onUpdate = vi.fn();
    withBuyerSteps(onUpdate, 'en')({ speaker: 'system', text: 'Hello' });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
