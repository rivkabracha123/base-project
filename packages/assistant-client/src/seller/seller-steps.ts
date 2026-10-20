type Language = 'he' | 'en';

const HOUSE_FUNCTIONS = ['rankSellerHouses', 'rankAndStoreSellerHouses', 'rankHousesForLead', 'getSellerHouseRecommendation'];
const COMPARISON_FUNCTIONS = ['calculateSellerValuation', 'searchSellerComparables', 'getSellerComparableHistory', 'getSellerPriceTrend'];

// Shown while the seller's photos upload.
export function sellerPhotosStepText(language: Language): string {
  return language === 'he' ? 'בודק את התמונות…' : 'Checking the photos…';
}

// Shown while a seller lookup runs, or undefined for an action that searches nothing.
export function sellerSearchingStepText(functionName: string, language: Language): string | undefined {
  if (HOUSE_FUNCTIONS.includes(functionName)) return language === 'he' ? 'מחפש בתי מכירות…' : 'Searching auction houses…';
  if (COMPARISON_FUNCTIONS.includes(functionName)) return language === 'he' ? 'משווה לעסקאות קודמות…' : 'Comparing with past deals…';
  return undefined;
}

// Tells the seller how many auction houses fit.
export function sellerHousesFoundStepText(count: number, language: Language): string {
  return language === 'he' ? `נמצאו ${count} בתי מכירות מתאימים` : `Found ${count} matching auction houses`;
}

// Tells the seller how many sales the comparison found: similar items, past sales, or prices for the trend.
export function sellerComparisonFoundStepText(mode: 'search' | 'history' | 'trend', count: number, language: Language): string {
  const texts = {
    search: { he: `נמצאו ${count} פריטים דומים`, en: `Found ${count} similar items` },
    history: { he: `נמצאו ${count} מכירות קודמות`, en: `Found ${count} past sales` },
    trend: { he: `נמצאו ${count} מחירים להשוואה`, en: `Found ${count} prices to compare` },
  };
  return texts[mode][language];
}
