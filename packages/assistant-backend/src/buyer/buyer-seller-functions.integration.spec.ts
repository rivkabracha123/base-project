import { BuyerP4FunctionExecutor } from './buyer-p4-function.executor';
import type { P4AiGenerateResponse } from '../ai/p4-ai.types';
import type { BuyerChatUpdate } from './buyer-chat-update';
import { findBuyerFixtureLot } from './fixture-lots.pool';

describe('buyer reuse of seller functions', () => {
  const house = (name: string, categories: string[], active = true) => ({ house: { name, categories, active } });
  const ranking = { rankHouses: jest.fn() };
  const comparisons = { findComparables: jest.fn() };
  const resolver = { findLot: jest.fn() };
  const criteria: { getCriteriaForSession: jest.Mock } = { getCriteriaForSession: jest.fn(() => ({ categories: ['paintings', 'rings'] })) };
  const executor = new BuyerP4FunctionExecutor({} as never, {} as never, criteria as never, resolver as never, ranking as never, comparisons as never);
  const context = { sessionId: 'buyer-session', language: 'en' as const, criteriaComplete: false };
  const response = (functionName: string, readyForFunction = true, intent?: string, args: Record<string, unknown> = { category: 'rings' }): P4AiGenerateResponse => ({
    extract: {} as never, readyForFunction, functionParameters: null,
    intentRoute: { functionName, readyForFunction, intent, arguments: args },
  });
  beforeEach(() => {
    jest.clearAllMocks();
    criteria.getCriteriaForSession.mockReturnValue({ categories: ['paintings', 'rings'] });
  });

  it('uses seller ranking but returns only active category specialists', async () => {
    ranking.rankHouses.mockReturnValue({ recommendation: house('Wrong category', ['paintings']), alternatives: [house('Ring expert', ['rings']), house('Inactive', ['rings'], false)] });
    const updates: BuyerChatUpdate[] = [];
    expect(await executor.execute(response('rankSellerHouses'), context, updates)).toBe(true);
    expect(ranking.rankHouses).toHaveBeenCalledWith({ category: 'rings', preferredLanguage: 'en' });
    expect(updates).toEqual([{ speaker: 'house-ranking', category: 'rings', ranking: {
      recommendation: house('Ring expert', ['rings']), alternatives: [],
    } }]);
  });
  it('reports no specialist rather than returning a wrong-category house', async () => {
    ranking.rankHouses.mockReturnValue({ recommendation: house('Wrong category', ['paintings']), alternatives: [] });
    const updates: BuyerChatUpdate[] = [];
    await executor.execute(response('rankSellerHouses'), context, updates);
    expect(updates[0]).toMatchObject({ text: 'No specialist auction houses were found for this category.' });
  });
  it.each(['rankSellerHouses', 'searchLots'])('does not execute %s when routing is blocked', async (name) => {
    expect(await executor.execute(response(name, false, name === 'searchLots' ? 'search_similar_lots' : undefined), context, [])).toBe(false);
    expect(ranking.rankHouses).not.toHaveBeenCalled();
    expect(comparisons.findComparables).not.toHaveBeenCalled();
  });
  it('resolves the selected lot server-side and uses seller comparisons, including upcoming items', async () => {
    const anchor = findBuyerFixtureLot('lot-history-upcoming-001')!;
    expect(anchor).toBeDefined();
    resolver.findLot.mockResolvedValue(anchor);
    const similar = { ...anchor, id: 'similar-upcoming' };
    comparisons.findComparables.mockResolvedValue({ included: [], excluded: [
      { lot: anchor, score: 1 }, { lot: similar, score: 1 },
      { lot: { ...anchor, id: 'completed', status: 'sold' }, score: 1 },
      { lot: { ...anchor, id: 'other', category: 'rings' }, score: 0 },
    ] });
    const updates: BuyerChatUpdate[] = [];
    await executor.execute(response('searchLots', true, 'search_similar_lots', {}), { ...context, p4Context: { selectedLot: { id: anchor.id } } }, updates);
    expect(comparisons.findComparables).toHaveBeenCalledWith({ category: anchor.category });
    expect(updates).toEqual([{ speaker: 'result-group', title: 'Similar items by category', lots: [similar] }]);
  });
  it('keeps similar lots inside the saved buyer budget', async () => {
    const anchor = findBuyerFixtureLot('lot-history-upcoming-001')!;
    criteria.getCriteriaForSession.mockReturnValue({ categories: [anchor.category], price: { max: 250, currency: 'USD' } });
    const inBudget = { ...anchor, id: 'sold-240', status: 'sold' as const, realizedPrice: { amount: 240, currency: 'USD' as const } };
    const overBudget = { ...anchor, id: 'sold-260', status: 'sold' as const, realizedPrice: { amount: 260, currency: 'USD' as const } };
    comparisons.findComparables.mockResolvedValue({ included: [], excluded: [
      { lot: inBudget, score: 1 }, { lot: overBudget, score: 1 },
    ] });
    const updates: BuyerChatUpdate[] = [];
    await executor.execute(response('searchLots', true, 'search_similar_lots', { category: anchor.category, status: 'sold' }), context, updates);
    expect(updates).toEqual([{ speaker: 'result-group', title: 'Similar items by category', lots: [inBudget] }]);
  });
  it('uses the latest saved buyer category without any seller draft or profile', async () => {
    comparisons.findComparables.mockResolvedValue({ included: [], excluded: [] });
    const updates: BuyerChatUpdate[] = [];
    await executor.execute(response('searchLots', true, 'search_similar_lots'), context, updates);
    expect(comparisons.findComparables).toHaveBeenCalledWith({ category: 'rings' });
    expect(updates[0]).toMatchObject({ speaker: 'no-results' });
  });
});
