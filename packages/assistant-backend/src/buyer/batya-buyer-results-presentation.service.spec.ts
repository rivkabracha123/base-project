import { emptyBuyerCriteria } from './buyer-criteria';
import { BuyerSearchExecutionService } from './buyer-search-execution.service';
import { BatyaBuyerResultsPresentationService } from './batya-buyer-results-presentation.service';
import { FixtureLotsSearchClient } from './fixture-lots-search.client';
import type { BuyerFlowUpdate } from './buyer-flow.types';
import type { LotsService } from '../lots/lots.service';
import { findBuyerFixtureLot, resolveBuyerFixtureLots } from './fixture-lots.pool';

describe('BatyaBuyerResultsPresentationService', () => {
  it('relays B3 progress and returns B3 outcome unchanged with display groups', async () => {
    const service = new BatyaBuyerResultsPresentationService(
      new BuyerSearchExecutionService(new FixtureLotsSearchClient()),
      {
        findOne: jest.fn(async (id: string) => findBuyerFixtureLot(id)),
      } as unknown as LotsService,
    );
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['rare_books'];
    const updates: BuyerFlowUpdate[] = [];

    const result = await service.presentSearchResults({
      searchContextId: 'session-1',
      criteria,
      selectedLotId: 'selected-lot',
      onUpdate: (update) => updates.push(update),
    });

    expect(result.outcome.kind).toBe('results');
    if (result.outcome.kind !== 'results') return;

    expect(result.outcome.selectedLotId).toBe('selected-lot');
    expect(result.groups[0]?.items[0]?.matchReasons).toBeDefined();
    expect(result.groups.flatMap((group) => group.items).every((entry) => entry.lot.status === 'upcoming')).toBe(true);
    expect(result.outcome.results.historical.length).toBeGreaterThan(0);
    expect(updates.some((update) => update.type === 'loading')).toBe(true);
    expect(updates.some((update) => update.type === 'progress')).toBe(true);
    expect(updates.some((update) => update.type === 'result_cards')).toBe(true);
  });

  it('tells the buyer each search step: searching, upcoming lots found, then the archive check', async () => {
    const service = new BatyaBuyerResultsPresentationService(
      new BuyerSearchExecutionService(new FixtureLotsSearchClient()),
      {} as LotsService,
    );
    const criteria = emptyBuyerCriteria('he');
    criteria.categories = ['rare_books'];
    criteria.price = { max: 1300, currency: 'USD' };
    // A period the lots search cannot read, so the buyer is told it was not filtered.
    criteria.periods = ['תקופה לא מוכרת'];
    const updates: BuyerFlowUpdate[] = [];

    const result = await service.presentSearchResults({
      searchContextId: 'session-steps',
      criteria,
      onUpdate: (update) => updates.push(update),
    });

    if (result.outcome.kind !== 'results') throw new Error('expected results');
    const { current, historical } = result.outcome.results;
    expect(updates).toEqual([
      { type: 'loading', text: 'מחפש…' },
      { type: 'progress', text: 'שימו לב: לא ניתן לסנן לפי תקופה, לכן התוצאות לא הוגבלו לפי זה.' },
      { type: 'progress', text: `נמצאו ${current.length} פריטים דומים במכירות הקרובות` },
      { type: 'progress', text: `נמצאו ${historical.length} פריטים דומים בארכיון מכירות קודמות` },
      expect.objectContaining({ type: 'result_cards' }),
    ]);
  });

  it('builds a trend only from B3-provided lot IDs with verified realized prices', async () => {
    const fixtureLots = resolveBuyerFixtureLots();
    const service = new BatyaBuyerResultsPresentationService(
      new BuyerSearchExecutionService(new FixtureLotsSearchClient()),
      {
        findOne: jest.fn(async (id: string) => fixtureLots.find((lot) => lot.id === id)),
      } as unknown as LotsService,
    );
    const updates: BuyerFlowUpdate[] = [];

    const result = await service.presentPriceTrend({
      lots: fixtureLots.map((lot) => ({ id: lot.id })),
      language: 'en',
      onUpdate: (update) => updates.push(update),
    });

    expect(result.points.every((point) => point.price.amount > 0)).toBe(true);
    expect(updates.some((update) => update.type === 'price_trend')).toBe(true);
  });
});
