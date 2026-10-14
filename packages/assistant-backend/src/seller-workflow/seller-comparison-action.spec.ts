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
    ['שלח פנייה לבית המכירות', 'getSellerEnquiryPreview'],
  ])('routes %s to %s', (message, functionName) => {
    expect(requestedSellerComparison(message)).toBe(functionName);
  });
  it('does not prepare a declined enquiry', () => {
    expect(requestedSellerComparison('לא רוצה לשלוח פנייה לבית המכירות')).toBeNull();
  });
});
