import { requestedSellerComparison } from './seller-comparison-action';

describe('seller demonstration requests', () => {
  it('does not treat an auction record question as a house recommendation', () => {
    expect(requestedSellerComparison('איזה פריט הכי יקר נמכר במכירה פומבית ובאיזה בית מכירות?')).toBeNull();
  });
  it.each([
    ['איך המחירים השתנו עם השנים?', 'getSellerPriceTrend'],
    ['הצג מחירים לאורך זמן', 'getSellerPriceTrend'],
    ['How have prices changed over the years?', 'getSellerPriceTrend'],
    ['אני רוצה פרטי פריט', 'getSellerItemDetails'],
    ['הצג את פרטי הפריט', 'getSellerItemDetails'],
    ['ירשתי כתב יד עתיק. איפה כדאי לי למכור אותו?', 'getSellerHouseRecommendation'],
    ['מה ההבדל במחיר בין מכירה בבתי מכירות בישראל למכירה בארהב?', 'getSellerHouseRecommendation'],
    ['יש סיכוי שהוא שווה יותר אם אמצא תיעוד על הכותב?', 'getSellerProvenanceAdvice'],
    ['תראה לי דוגמאות דומות שנמכרו בעבר', 'getSellerComparableHistory'],
    ['כתוב עבורי תיאור מקצועי לקטלוג', 'getSellerCatalogDraft'],
    ['אני רוצה גם שתכתוב עבורי תיאור מקצועי על פרטי הפריט', 'getSellerCatalogDraft'],
    ['תנסחי לי תיאור לפריט', 'getSellerCatalogDraft'],
    ['Please write a professional description of my item', 'getSellerCatalogDraft'],
    ['שלח פנייה לבית המכירות', 'getSellerEnquiryPreview'],
    ['אני רוצה ליצור פנייה לבית מכירות', 'getSellerEnquiryPreview'],
    ['Create an enquiry for the auction house', 'getSellerEnquiryPreview'],
  ])('routes %s to %s', (message, functionName) => {
    expect(requestedSellerComparison(message)).toBe(functionName);
  });
  it('does not prepare a declined enquiry', () => {
    expect(requestedSellerComparison('לא רוצה לשלוח פנייה לבית המכירות')).toBeNull();
  });
  it.each([
    'תראה לי את הטיוטה',
    'אני רוצה לראות את הניסוח',
    'אני רוצה לערוך את תיאור הקטלוג',
    'תראה לי את טיוטת הפריט',
    'show me the catalog draft',
    'edit the description',
  ])('opens the item details to see or edit the drafted text: %s', (input) => {
    expect(requestedSellerComparison(input)).toBe('getSellerItemDetails');
  });
  it.each([
    'אני רוצה שתנסח לי תיאור לקטלוג',
    'אני רוצה שתנסח לי טיוטת פריט',
    'תכין טיוטה לפריט שלי',
    'write a catalog description',
  ])('still drafts a new catalog description: %s', (input) => {
    expect(requestedSellerComparison(input)).toBe('getSellerCatalogDraft');
  });
  it('keeps enquiry edits on the enquiry flow', () => {
    expect(requestedSellerComparison('אני רוצה לערוך את טיוטת הפנייה')).not.toBe('getSellerItemDetails');
  });
});
