import { routeBuyerIntent } from './intent-router';

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
      missingFields: ['selectedLot', 'lots'],
      arguments: {},
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
