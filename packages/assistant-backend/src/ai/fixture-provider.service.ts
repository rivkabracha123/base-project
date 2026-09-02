export type FixtureProviderRequest = {
  prompt: string;
  language?: 'he' | 'en';
};

export type FixtureProviderResponse = {
  provider: 'fixture';
  mode: 'fixture';
  content: string;
  summary: string;
  recommendation: string;
  nextAction: string;
  confidence: 'low' | 'medium';
};

//take the ansewer from the fixture provider and return it in the expected format

export class FixtureProviderService {
  async generate(input: FixtureProviderRequest): Promise<FixtureProviderResponse> {
    const prompt = input.prompt ?? '';
    const normalizedPrompt = prompt.toLowerCase();
    const language = input.language ?? 'he';

    const hasBlue = normalizedPrompt.includes('כחולה') || normalizedPrompt.includes('blue');
    const yearMatch = prompt.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : 'לא צוין';

    const itemName = hasBlue ? 'טבעת כחולה' : 'פריט דוגמתי';
    const summary = hasBlue ? 'המשתמש מחפש פריט קשור לצבע כחול' : 'המשתמש מחפש פריט דוגמתי';
    const recommendation = hasBlue ? 'הצג פריטים דומים עם צבע כחול או בקש פרטים נוספים' : 'הצג אפשרויות נוספות ומידע נוסף';
    const nextAction = hasBlue ? 'בקש מידע נוסף על תקציב והזדמנות לרכישה' : 'בקש פרטים נוספים כדי להדריך טוב יותר';
    const confidence: FixtureProviderResponse['confidence'] = hasBlue ? 'medium' : 'low';

    if (language === 'en') {
      return {
        provider: 'fixture',
        mode: 'fixture',
        content: `Fixture result: ${itemName} from ${year}. This is a deterministic fixture response used for testing and safe fallback when the real provider is unavailable.`,
        summary,
        recommendation,
        nextAction,
        confidence,
      };
    }

    return {
      provider: 'fixture',
      mode: 'fixture',
      content: `תוצאה קבועה (fixture): ${itemName} משנת ${year}. זו תשובה דטרמיניסטית לשימוש בבדיקות ובמקרה של כשל במפרסם האמיתי.`,
      summary,
      recommendation,
      nextAction,
      confidence,
    };
  }
}
