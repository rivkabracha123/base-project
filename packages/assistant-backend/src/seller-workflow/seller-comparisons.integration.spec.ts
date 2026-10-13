import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuctionLot } from '@monabid/shared';
import { ComparablesService } from '../comparables/comparables.service';
import { SellerWorkflowService } from './seller-workflow.service';
import { SellerIntakeController } from '../seller-intake/seller-intake.controller';

const item = { category: 'rings', title: 'My ring', dimensions: { values: [{ label: 'size', value: 8, unit: 'ring_size' }] }, condition: 'Good' };
const lot: AuctionLot = {
  id: 'sale-1', category: 'rings', status: 'sold', saleDate: '2024-01-01',
  title: { en: 'Silver ring' }, description: { en: 'Silver ring' },
  source: { provider: 'test', recordId: '1', url: 'https://example.test/1', retrievedAt: '2025-01-01T00:00:00.000Z' },
  auctionHouse: { id: 'house-1', name: 'House' }, auctionTitle: 'Auction', lotNumber: '1', realizedPrice: { amount: 100, currency: 'USD' },
};

describe('seller comparable actions integration', () => {
  const drafts = { getDraft: jest.fn(), saveIntakeTurn: jest.fn() };
  const rows = [lot, { ...lot, id: 'upcoming', status: 'upcoming', realizedPrice: undefined }, { ...lot, id: 'wrong-category', category: 'paintings' }, { ...lot, id: 'gold', title: { en: 'Gold ring' }, description: { en: 'Gold' } }];
  const comparisons = new ComparablesService({ find: async () => rows.map((payload) => ({ payload })) } as never);
  const workflow = new SellerWorkflowService({} as never, {} as never, undefined, drafts as never, undefined, comparisons);
  beforeEach(() => drafts.getDraft.mockReset().mockResolvedValue({ draft: { item, confirmedFacts: { materials: ['silver'] } } }));

  it.each(['getSellerComparableHistory', 'getSellerPriceTrend'] as const)('uses credible completed similar sales for %s', async (functionToRun) => {
    const result = await workflow.execute({ profileId: 'owner', structuredAnswer: { functionToRun, object: { sessionId: 'session', category: 'paintings', lots: [] } } });
    expect(drafts.getDraft).toHaveBeenCalledWith('owner', 'session');
    expect(result.result).toEqual({ criteria: { category: 'rings', materials: ['silver'] }, lots: [lot] });
  });
  it('search includes similar upcoming lots, not weak or different-category matches', async () => {
    const result = await workflow.execute({ profileId: 'owner', structuredAnswer: { functionToRun: 'searchSellerComparables', object: { sessionId: 'session' } } });
    expect((result.result as { lots: AuctionLot[] }).lots.map((row) => row.id)).toEqual(['upcoming']);
  });
  it('returns only item details without seller contact or other draft fields', async () => {
    const result = await workflow.execute({ profileId: 'owner', structuredAnswer: { functionToRun: 'getSellerItemDetails', object: { sessionId: 'session' } } });
    expect(result.result).toEqual({ item });
  });
  it('matches existing jewelry drafts describing a ring to canonical rings without rewriting the draft', async () => {
    const savedItem = { ...item, category: 'jewelry', title: 'Blue ring' };
    drafts.getDraft.mockResolvedValueOnce({ draft: { item: savedItem, confirmedFacts: {} } });
    const result = await workflow.execute({ profileId: 'owner', structuredAnswer: { functionToRun: 'getSellerComparableHistory', object: { sessionId: 'session' } } });
    expect(result.result).toMatchObject({ criteria: { category: 'rings' } });
    expect((result.result as { lots: AuctionLot[] }).lots.map((row) => row.id)).toContain('sale-1');
    expect(savedItem.category).toBe('jewelry');
  });
  it('rejects an old draft where a comparison command was saved as condition', async () => {
    drafts.getDraft.mockResolvedValueOnce({ draft: { item: { ...item, condition: 'Show previous sales' }, confirmedFacts: {} } });
    await expect(workflow.execute({ profileId: 'owner', structuredAnswer: { functionToRun: 'getSellerPriceTrend', object: { sessionId: 'session' } } })).rejects.toThrow(BadRequestException);
  });
  it('rejects incomplete and inaccessible drafts even for direct callbacks', async () => {
    const request = { profileId: 'owner', structuredAnswer: { functionToRun: 'getSellerPriceTrend' as const, object: { sessionId: 'session' } } };
    drafts.getDraft.mockResolvedValueOnce({ draft: { item: { ...item, condition: undefined } } });
    await expect(workflow.execute(request)).rejects.toThrow(BadRequestException);
    drafts.getDraft.mockRejectedValueOnce(new NotFoundException());
    await expect(workflow.execute(request)).rejects.toThrow(NotFoundException);
  });
  it.each(['Show previous sales', '\u05d0\u05e0\u05d9 \u05e8\u05d5\u05e6\u05d4 \u05dc\u05e8\u05d0\u05d5\u05ea \u05de\u05db\u05d9\u05e8\u05d5\u05ea \u05d3\u05d5\u05de\u05d5\u05ea'])('routes %s from the saved draft without re-extracting or changing item facts', async (input) => {
    const ai = { analyze: jest.fn() };
    const controller = new SellerIntakeController(ai as never, drafts as never, {} as never);
    const result = await controller.createDraft({ profileId: 'owner', sessionId: 'session', input });
    expect(result.functionCall).toEqual({ functionToRun: 'getSellerComparableHistory', object: { sessionId: 'session' } });
    expect(result.nextQuestion).toBeNull();
    expect(ai.analyze).not.toHaveBeenCalled();
    const response = await workflow.execute({ profileId: 'owner', structuredAnswer: result.functionCall as never });
    expect((response.result as { lots: AuctionLot[] }).lots).toEqual([lot]);
  });
  it('remembers a comparison requested before mandatory fields are complete', async () => {
    drafts.getDraft.mockRejectedValueOnce(new NotFoundException());
    const ai = { analyze: jest.fn().mockResolvedValueOnce({ item, seller: {}, requiredMissingFields: ['condition'], nextQuestion: { field: 'condition', en: 'Condition?', he: 'Condition?' } }).mockResolvedValue({ item, seller: {}, requiredMissingFields: [], missingFields: ['provenance'], nextQuestion: null }) };
    const controller = new SellerIntakeController(ai as never, drafts as never, {} as never);
    const scope = { profileId: 'owner', sessionId: 'session' };
    expect((await controller.createDraft({ ...scope, input: 'Show a price chart' })).functionCall).toBeUndefined();
    expect((await controller.createDraft({ ...scope, input: 'Good condition' })).functionCall?.functionToRun).toBe('getSellerPriceTrend');
    expect((await controller.createDraft({ ...scope, input: 'Thanks' })).functionCall).toBeUndefined();
  });
  it('cancels a pending comparison and does not offer actions without a request', async () => {
    drafts.getDraft.mockRejectedValueOnce(new NotFoundException());
    const ai = { analyze: jest.fn().mockResolvedValueOnce({ item, seller: {}, requiredMissingFields: ['condition'] }).mockResolvedValue({ item, seller: {}, requiredMissingFields: [] }) };
    const controller = new SellerIntakeController(ai as never, drafts as never, {} as never);
    const scope = { profileId: 'owner', sessionId: 'session' };
    await controller.createDraft({ ...scope, input: 'Show a price chart' });
    expect((await controller.createDraft({ ...scope, input: 'Cancel the chart' })).functionCall).toBeUndefined();
    expect((await controller.createDraft({ ...scope, input: 'Good condition' })).functionCall).toBeUndefined();
  });
});
