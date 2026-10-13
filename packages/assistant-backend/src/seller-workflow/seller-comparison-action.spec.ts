import { requestedSellerComparison } from './seller-comparison-action';

describe('seller demonstration requests', () => {
  it.each([
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
