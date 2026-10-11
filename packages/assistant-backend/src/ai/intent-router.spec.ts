import { routeBuyerIntent } from './intent-router';
import { buildCompletionState } from './completion-state';

describe('routeBuyerIntent', () => {
  it('routes Hebrew buyer house specialization with category and geography', () => {
    expect(routeBuyerIntent('איזה בית מכירות הכי מתמחה בתחום הזה?', { category: 'judaica', geography: 'Israel', language: 'he' })).toEqual({
      intent: 'buyer_house_ranking', functionName: 'rankSellerHouses', readyForFunction: true,
      missingFields: [], arguments: { category: 'judaica', geography: 'Israel', language: 'he' },
    });
  });
  it('requires a category rather than inventing one for house rankings', () => {
    expect(routeBuyerIntent('Which auction house specializes in this category?', { language: 'en' })).toMatchObject({
      functionName: 'rankSellerHouses', readyForFunction: false, missingFields: ['category'], arguments: { language: 'en' },
    });
  });
  it('routes sale-history requests when the selected lot data is complete', () => {
    const selectedLot = { id: 'lot-1', itemKey: 'manuscript-1' };
    const lots = [{ id: 'lot-2', itemKey: 'manuscript-1', status: 'sold' }];

    expect(routeBuyerIntent('תציג לי את היסטוריית המכירות שלו', { selectedLot, lots })).toEqual({
      intent: 'same_item_sale_history',
      functionName: 'getComparableSaleHistory',
      readyForFunction: true,
      missingFields: [],
      arguments: { selectedLot, lots },
    });
  });
  //test required context is missing
  it('keeps sale history blocked when required context is missing', () => {
    expect(routeBuyerIntent('הצג לי את היסטוריית המכירות שלו')).toEqual({
      intent: 'same_item_sale_history',
      functionName: 'getComparableSaleHistory',
      readyForFunction: false,
      missingFields: ['selectedLot.id'],
      arguments: {},
    });
  });
  it('allows B2 to resolve sale history from a lot id alone', () => {
    expect(routeBuyerIntent('היסטוריית מכירות', { selectedLot: { id: 'lot-1' } })).toMatchObject({
      functionName: 'getComparableSaleHistory', readyForFunction: true, missingFields: [],
    });
  });
  it('routes ready search requests to B2 with the session id', () => {
    const completionState = buildCompletionState({
      category: { required: true, status: 'provided', value: 'paintings' },
      budget: { required: false, status: 'skipped', value: null },
    });
    expect(routeBuyerIntent('חפש ציורים', { completionState, sessionId: 'session-1' })).toEqual({
      intent: 'search_auction_lots', functionName: 'searchLots', readyForFunction: true,
      missingFields: [], arguments: { language: 'he', sessionId: 'session-1' },
    });
  });
  it('blocks search when required facts are missing or uncertain', () => {
    const completionState = buildCompletionState({
      category: { required: true, status: 'uncertain', value: null },
    });
    expect(routeBuyerIntent('Find items', { completionState })).toMatchObject({
      functionName: 'searchLots', readyForFunction: false, missingFields: ['category'],
    });
    expect(routeBuyerIntent('Find items')).toMatchObject({
      readyForFunction: false, missingFields: ['completionState'],
    });
  });
//test similar iteam
  it('recognizes similar items but does not call an undefined function', () => {
    expect(routeBuyerIntent('תציג לי פריטים דומים', { selectedLot: { id: 'lot-1' } })).toEqual({
      intent: 'search_similar_lots',
      functionName: null,
      readyForFunction: false,
      missingFields: ['similarLotsFunction'],
      arguments: { selectedLot: { id: 'lot-1' }, language: 'he' },
    });
  });
  //test when lot has id
  it('routes item details only when the selected lot has an id', () => {
    expect(routeBuyerIntent('תציג לי את פרטי הפריט', { selectedLot: { id: 'lot-1' } })).toEqual({
      intent: 'get_lot_details',
      functionName: 'getLotById',
      readyForFunction: true,
      missingFields: [],
      arguments: { id: 'lot-1', language: 'he' },
    });
  });
});
