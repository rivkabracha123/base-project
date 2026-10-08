const HEBREW_LETTER = /[\u0590-\u05FF]/;

export function detectBuyerLanguage(text: string): 'he' | 'en' {
  return HEBREW_LETTER.test(text) ? 'he' : 'en';
}
