import { routeBuyerIntent } from './intent-router';
import { buildCompletionState } from './completion-state';

describe('routeBuyerIntent', () => {
  it('ignores earlier assistant text when routing the latest buyer message', () => {
    const prompt = 'Conversation so far:\nBuyer: כתב יד עתיק\nAssistant: בדקנו גם בארכיון המכירות: נמצאו 7 מכירות קודמות דומות.\n\nLatest buyer message:\nרק מכירות עתידיות';
    expect(routeBuyerIntent(prompt, { category: 'rare_books' }).intent).not.toBe('search_similar_lots');
  });
  it('searches sold lots when the buyer asks how similar items sold before', () => {
    expect(routeBuyerIntent('כמה נמכרו פריטים דומים בעבר?', { category: 'rare_books' }).arguments)
      .toEqual(expect.objectContaining({ status: 'sold', category: 'rare_books' }));
  });
  it('routes the demo wording about changing prices to a trend, not item history', () => {
    expect(routeBuyerIntent('איך המחירים של כתבי יד כאלה השתנו בשנים האחרונות?', { lots: [{ id: 'sold-1' }] }))
      .toMatchObject({ functionName: 'getPriceTrend', readyForFunction: true });
  });
  it('routes extra details about the first item using its resolved selection', () => {
    expect(routeBuyerIntent('תראה לי פרטים נוספים על הפריט הראשון', { selectedLot: { id: 'first-lot' } }))
      .toMatchObject({ functionName: 'getLotById', readyForFunction: true, arguments: { id: 'first-lot' } });
  });
  it('routes past sales by saved category when no item is selected', () => {
    expect(routeBuyerIntent('מכירות עבר', { category: 'rings' })).toMatchObject({
      intent: 'search_similar_lots', readyForFunction: true, arguments: { status: 'sold', category: 'rings' },
    });
  });
  it.each(['גרף מחירים', 'הצג גרף', 'Show a price chart'])('routes chart requests: %s', prompt => {
    expect(routeBuyerIntent(prompt, { lots: [{ id: 'sale' }] })).toMatchObject({ functionName: 'getPriceTrend', readyForFunction: true });
  });
  it.each(['היסטוריה', 'אני רוצה היסטוריה', 'history', 'מכירות קודמות', 'מכירות בעבר', 'past sales'])('routes completed sale history: %s', prompt => {
    expect(routeBuyerIntent(prompt, { selectedLot: { id: 'lot' } })).toMatchObject({ functionName: 'getComparableSaleHistory', readyForFunction: true });
  });
  it('routes a short request for similar sales using the saved category', () => {
    expect(routeBuyerIntent('מכירות דומות', { category: 'rings' })).toMatchObject({ intent: 'search_similar_lots', functionName: 'searchLots', readyForFunction: true });
  });
  it.each(['Show the price trend', '\u05de\u05d2\u05de\u05ea \u05de\u05d7\u05d9\u05e8\u05d9\u05dd'])('routes price trends before generic sale-history matching: %s', prompt => {
    expect(routeBuyerIntent(prompt, { lots: [{ id: 'lot-1' }] })).toMatchObject({ functionName: 'getPriceTrend', readyForFunction: true, arguments: {} });
    expect(routeBuyerIntent(prompt)).toMatchObject({ readyForFunction: false, missingFields: ['lots'] });
  });
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
  it('routes similar items to the connected search handler with a selected lot', () => {
    expect(routeBuyerIntent('תציג לי פריטים דומים', { selectedLot: { id: 'lot-1' } })).toEqual({
      intent: 'search_similar_lots',
      functionName: 'searchLots',
      readyForFunction: true,
      missingFields: [],
      arguments: { selectedLot: { id: 'lot-1' }, language: 'he' },
    });
  });
  it('requires a selected lot or saved category for similarity search', () => {
    expect(routeBuyerIntent('Find similar items')).toMatchObject({ readyForFunction: false, missingFields: ['selectedLot.id or category'] });
    expect(routeBuyerIntent('Find similar items', { category: 'rings' })).toMatchObject({ functionName: 'searchLots', readyForFunction: true });
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
