import type { AiRole } from './ai.dto';

export type FixtureProviderRequest = {
  prompt: string;
  role?: AiRole;
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
  structuredAnswer: {
    role: AiRole;
    language: 'he' | 'en';
    intent: string;
    category: string;
    creators?: string[];
    periods?: string[];
    price?: { min?: number; max?: number; currency?: string };
    keywords?: string[];
    geography?: string[];
    hasContactDetails: boolean;
    hasImages: boolean;
    confirmedFacts?: string[];
    uncertainFacts?: string[];
    sellerConfirmation?: {
      required: boolean;
      status: 'pending' | 'confirmed' | 'rejected';
    };
    item?: {
      title?: string;
      dimensions?: string;
      condition?: string;
      markings?: string;
      signature?: string;
      provenance?: string;
      notes?: string[];
    };
  };
};

//take the ansewer from the fixture provider and return it in the expected format

export class FixtureProviderService {
  async generate(input: FixtureProviderRequest): Promise<FixtureProviderResponse> {
    const prompt = input.prompt ?? '';
    const normalizedPrompt = prompt.toLowerCase();
    const language = input.language ?? 'he';
    const role = input.role ?? 'buyer';

    const hasBlue = normalizedPrompt.includes('blue') || normalizedPrompt.includes('כחול') || normalizedPrompt.includes('׳›׳—׳•׳׳”');
    const hasPainting = normalizedPrompt.includes('painting') || normalizedPrompt.includes('ציור');
    const hasBudget = /budget|תקציב|[$₪]\s*\d|עד\s*\d/.test(normalizedPrompt);
    const hasItemType = /ring|painting|item|טבעת|ציור|פריט/.test(normalizedPrompt);
    const hasYear = /\b(19|20)\d{2}\b/.test(prompt);
    const yearMatch = prompt.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : 'לא צוין';

    const itemName = hasBlue ? 'טבעת כחולה' : 'פריט דוגמתי';
    const summary = hasBlue ? 'המשתמש מחפש פריט קשור לצבע כחול' : 'המשתמש מחפש פריט דוגמתי';
    const recommendation = hasBlue ? 'הצג פריטים דומים עם צבע כחול או בקש פרטים נוספים' : 'הצג אפשרויות נוספות ומידע נוסף';
    const nextAction = hasBlue ? 'בקש מידע נוסף על תקציב והזדמנות לרכישה' : 'בקש פרטים נוספים כדי להדריך טוב יותר';
    const confidence: FixtureProviderResponse['confidence'] = hasBlue ? 'medium' : 'low';

    const structuredAnswer = role === 'seller'
      ? {
          role: 'seller' as const,
          language,
          intent: 'Prepare an item for auction review.',
          category: hasPainting ? 'paintings' : 'general',
          item: { title: hasPainting ? (language === 'he' ? 'ציור כחול' : 'Blue item') : undefined },
          missingFacts: hasPainting ? ['dimensions', 'condition', 'provenance'] : ['item title', 'category', 'dimensions'],
          confirmedFacts: [],
          uncertainFacts: hasPainting ? ['title'] : [],
          sellerConfirmation: {
            required: true,
            status: 'pending' as const,
          },
          hasContactDetails: false,
          hasImages: false,
        }
      : {
          role: 'buyer' as const,
          language,
          intent: hasBlue ? 'Find a blue item with a matching time period and budget.' : 'Review a general buyer request for more useful details.',
          category: hasBlue ? 'rings' : 'general',
          ...(hasBlue ? { category: 'rings', keywords: ['blue'] } : {}),
          ...(hasYear ? { periods: [year] } : {}),
          ...(hasBudget ? { price: { max: 5000, currency: 'ILS' } } : {}),
          hasContactDetails: false,
          hasImages: false,
        };

    if (language === 'en') {
      return {
        provider: 'fixture',
        mode: 'fixture',
        content: `Fixture result: ${itemName} from ${year}. This is a deterministic fixture response used for testing and safe fallback when the real provider is unavailable.`,
        summary,
        recommendation,
        nextAction,
        confidence,
        structuredAnswer: {
          ...structuredAnswer,
          language: 'en',
          ...(role === 'buyer' ? {
            intent: hasBlue ? 'Find a blue ring matching the requested period and budget.' : 'Review a general buyer request and ask for missing details.',
            category: hasBlue ? 'rings' : 'general',
          } : {}),
        },
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
      structuredAnswer: {
        ...structuredAnswer,
        language: 'he',
        ...(role === 'buyer' ? {
          intent: hasBlue ? 'מצא טבעת כחולה המתאימה לתקופה ולתקציב המבוקש.' : 'עיין בבקשת קונה כללית ואל תבקש פרטים חסרים.',
          category: hasBlue ? 'טבעות' : 'כללי',
        } : {}),
      },
    };
  }
}
