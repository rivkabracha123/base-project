import { emptyBuyerCriteria } from './buyer-criteria';
import { BuyerSearchExecutionService } from './buyer-search-execution.service';
import { DefaultBuyerResultsPresentationService } from './default-buyer-results-presentation.service';
import { FixtureLotsSearchClient } from './fixture-lots-search.client';
import type { BuyerFlowUpdate } from './buyer-flow.types';

describe('DefaultBuyerResultsPresentationService', () => {
  it('returns groups with matchReasons and full outcome from B3', async () => {
    const service = new DefaultBuyerResultsPresentationService(
      new BuyerSearchExecutionService(new FixtureLotsSearchClient()),
    );
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['painting'];
    criteria.keywords = ['blue'];

    const flowUpdates: BuyerFlowUpdate[] = [];
    const result = await service.presentSearchResults({
      searchContextId: 'session-1',
      criteria,
      onUpdate: (update) => flowUpdates.push(update),
    });

    expect(result.outcome.kind).toBe('results');
    if (result.outcome.kind !== 'results') {
      return;
    }
    expect(result.groups.length).toBeGreaterThan(0);
    expect(result.groups[0]?.items[0]?.matchReasons).toBeDefined();
    expect(flowUpdates.some((u) => u.type === 'loading')).toBe(true);
    expect(flowUpdates.some((u) => u.type === 'result_cards')).toBe(true);
  });
});
