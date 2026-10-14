export type SellerComparisonAction = 'searchSellerComparables' | 'getSellerComparableHistory' | 'getSellerPriceTrend' | 'getSellerItemDetails' | 'getSellerCatalogDraft' | 'getSellerEnquiryPreview' | 'getSellerProvenanceAdvice' | 'getSellerHouseRecommendation';

export function requestedSellerComparison(input: string): SellerComparisonAction | null {
  if (isGeneralAuctionQuestion(input)) return null;
  if (/\b(?:don't|do not|cancel)\b|\u05dc\u05d0\s+(?:\u05e8\u05d5\u05e6\u05d4|\u05de\u05e2\u05d5\u05e0\u05d9\u05d9?\u05df)|\u05d1\u05d8\u05dc/i.test(input)) return null;
  if (/(?:מחיר|prices?).*(?:השתנ|שנים|לאורך\s+זמן|changes?|changed|over\s+(?:time|the\s+years))|(?:השתנ|changes?|changed).*(?:מחיר|prices?)/i.test(input)) return 'getSellerPriceTrend';
  if (/תיאור.*קטלוג|קטלוג.*תיאור|catalog(?:ue)?\s+(?:description|draft)/i.test(input)) return 'getSellerCatalogDraft';
  if (/(?:איפה|היכן).*למכור|where.*sell|הבדל.*(?:בתי|בית)\s+מכירות/i.test(input)) return 'getSellerHouseRecommendation';
  if (/(?:בית|בתי)\s+מכירות|auction houses?/i.test(input)
    && /מומל|מתאים|רוצה|מחפש|תמצא|הצג|איזה|אילו|recommend|suitable|find|show|which|looking for/i.test(input)) return 'getSellerHouseRecommendation';
  if (/(?:שלח|הכן|הכיני|טיוטת).*פני[יה]|(?:prepare|send).*enquiry/i.test(input)) return 'getSellerEnquiryPreview';
  if (/(?:תיעוד|מקור|provenance|documentation).*(?:שווה|שווי|ערך|value)|(?:שווה|שווי|ערך|value).*(?:תיעוד|מקור|provenance|documentation)/i.test(input)) return 'getSellerProvenanceAdvice';
  if (/\b(?:graphs?|charts?|price trends?)\b|\u05d2\u05e8\u05e3|\u05de\u05d2\u05de(?:\u05ea|\u05d5\u05ea)\s+\u05de\u05d7\u05d9\u05e8\u05d9\u05dd/i.test(input)) return 'getSellerPriceTrend';
  if (/\b(?:similar sales|past sales|historical sales)\b|\u05de\u05db\u05d9\u05e8\u05d5\u05ea\s+\u05d3\u05d5\u05de\u05d5\u05ea|\u05de\u05db\u05d9\u05e8\u05d5\u05ea\s+\u05d1\u05e2\u05d1\u05e8|\u05d4\u05d9\u05e1\u05d8\u05d5\u05e8\u05d9\u05d9?\u05ea\s+(?:\u05d4\u05de\u05db\u05d9\u05e8\u05d5\u05ea|\u05de\u05db\u05d9\u05e8\u05d5\u05ea)/i.test(input)) return 'getSellerComparableHistory';
  if (/\b(?:don't|do not|cancel)\b|לא\s+(?:רוצה|מעוניי?נ)|בטל/i.test(input)) return null;
  if (/\b(?:graph|chart|price trend)\b|גרף|מגמת\s+מחירים/i.test(input)) return 'getSellerPriceTrend';
  if (/previous sales|sale history|sales history|מכירות\s+(?:קודמות|עבר)|(?:דוגמאות|פריטים).*נמכרו.*(?:בעבר|עבר)|היסטוריי?ת\s+מכירות/i.test(input)) return 'getSellerComparableHistory';
  if (/item details|more details|פרטים\s+(?:נוספים|על\s+(?:ה)?פריט)|פרטי\s+(?:ה)?פריט/i.test(input)) return 'getSellerItemDetails';
  if (/\b(?:search|find)\b.*\b(?:similar|items|lots|criteria)\b|חפש|חיפוש|פריטים\s+דומים/i.test(input)) return 'searchSellerComparables';
  return null;
}
import { isGeneralAuctionQuestion } from '../ai/off-topic';
