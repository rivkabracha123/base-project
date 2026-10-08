import type { AiRole } from './ai.dto';
import type { BuyerExtraction } from './buyer-handoff';
import { buildCompletionState, type FieldCompletion } from './completion-state';
//budget
const unitPattern = String.raw`(?:אלפים|אלף|מיליונים|מיליון|thousand\b|million\b|k\b)`;
const currencyPattern = String.raw`(?:שקלים|שקל|ש["״']?ח|₪|shekels?\b|ils\b|usd\b|dollars?\b|\$|eur\b|euros?\b|€)`;
const amountPattern = String.raw`(?:${currencyPattern}\s*)?\d+(?:,\d{3})*(?:\.\d+)?\s*(?:${unitPattern})?\s*(?:${currencyPattern})?`;

function multiplier(amount: string): number {
  if (/מיליון|מיליונים|million/i.test(amount)) return 1_000_000;
  if (/אלף|אלפים|thousand|k\b/i.test(amount)) return 1_000;
  return 1;
}

function currency(amount: string): string {
  if (/\$|usd|dollar/i.test(amount)) return 'USD';
  if (/€|eur|euro/i.test(amount)) return 'EUR';
  return 'ILS';
}

function value(amount: string, scale = multiplier(amount)): number {
  return Number(amount.match(/\d[\d,.]*/)?.[0].replace(/,/g, '')) * scale;
}

// Require monetary context so a production year is not treated as a budget.
function extractFixtureBudget(prompt: string): BuyerExtraction['price'] {
  const text = prompt.toLowerCase().replace(/[־–—]/g, '-');
  const range = text.match(new RegExp(`(${amountPattern})\\s*(?:עד|ל-?|and\\b|to\\b|-)\\s*(${amountPattern})`, 'i'));
  const startsWithYear = range && /(?:משנת|שנת|year|from)\s*$/.test(text.slice(0, range.index));
  if (!startsWithYear && range?.[1] && range[2] && (new RegExp(`${currencyPattern}|${unitPattern}`, 'i').test(range[0]) || /budget|תקציב/.test(text.slice(0, range.index)))) {
    // In "5 to 8 thousand", the trailing unit applies to both endpoints.
    const hasFirstUnit = new RegExp(`${unitPattern}|${currencyPattern}`, 'i').test(range[1]);
    const min = value(range[1], hasFirstUnit ? multiplier(range[1]) : multiplier(range[2]));
    const max = value(range[2]);
    if (Number.isFinite(min) && Number.isFinite(max) && min <= max) {
      return { min, max, currency: currency(range[0]) };
    }
    return undefined;
  }

  const upper = text.match(new RegExp(`(?:עד|up to\\b|under\\b|budget\\s*(?:of|is|:)?|תקציב\\s*:?)(?:\\s*-?\\s*)(${amountPattern})`, 'i'));
  const monetary = text.match(new RegExp(`(${amountPattern})`, 'gi'))?.find(amount => new RegExp(currencyPattern, 'i').test(amount));
  const amount = upper?.[1] ?? monetary;
  if (!amount) return undefined;
  const max = value(amount);
  return Number.isFinite(max) ? { max, currency: currency(amount) } : undefined;
}

export type FixtureProviderRequest = {
  prompt: string;
  role?: AiRole;
  language?: 'he' | 'en';
  fallbackMode?: 'guided';
};

export type FixtureProviderResponse = {
  provider: 'fixture';
  mode: 'fixture';
  fallbackMode?: 'guided';
  isRelevant: boolean;
  error: string | null;
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
    completionState?: ReturnType<typeof buildCompletionState>;
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
    const hasRing = /\brings?\b|טבעת|טבעות/.test(normalizedPrompt);
    const hasPink = /\bpink\b|ורוד/.test(normalizedPrompt);
    const color = hasPink ? 'pink' : hasBlue ? 'blue' : undefined;
    const englishItem = [color, hasRing ? 'ring' : hasPainting ? 'painting' : 'item'].filter(Boolean).join(' ');
    const price = role === 'buyer' ? extractFixtureBudget(prompt) : undefined;
    const hasItemType =
      /ring|painting|item|photo|picture|book|watch|jewelry|coin|furniture|stamp|manuscript|rolex|טבעת|ציור|פריט|תמונה|כתב יד|שעונ|תכשיט|מטבע|רהיט|ספר|בול|רולקס/.test(
        normalizedPrompt,
      );
    const hasTradeIntent =
      /\b(sell|selling|buy|buying|purchase|looking for)\b|למכור|למכירה|מוכר|לקנות|לקנייה|קונה|מחפש|מחפשת|מחפשים|בחיפוש/.test(
        normalizedPrompt,
      );
    const isRelevant = hasItemType || hasTradeIntent;
    // Seller fact detection so missingFacts/confirmedFacts reflect this specific prompt instead of a fixed list.
    const hasCondition = /מצב\s*(?:שימור|כללי|ה?פריט)?\s*(?:טוב|טובה|בינוני|בינונית|רע|רעה|מצוין|מצוינת|תקין|תקינה|ירוד|ירודה)|(?:good|fair|poor|excellent|mint)\s*condition/i.test(prompt);
    const hasSignature = /חתימה|חתום|חתומה|\bsigned\b|\bsignature\b/i.test(normalizedPrompt);
    const hasDimensions = /מידות|\d+\s*[×x]\s*\d+|\bcm\b|ס["׳]?מ|\binch(?:es)?\b/i.test(prompt);
    const hasProvenance = /מקור|תיעוד|\bprovenance\b|history of ownership/i.test(normalizedPrompt);
    const error = isRelevant
      ? null
      : language === 'en'
        ? 'The request is not related to buying or selling items.'
        : 'השאלה אינה קשורה לקנייה או למכירה של פריטים.';
    const hasYear = /\b(19|20)\d{2}\b/.test(prompt);
    const yearMatch = prompt.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : 'לא צוין';

    const budgetSkipped = /ללא הגבלת תקציב|אין הגבלת תקציב|אין לי תקציב מוגדר|no budget limit|no fixed budget|any budget/i.test(prompt);
    const periodSpecified = hasYear || /עתיק|וינטג|מודרני|מאה|\b(?:antique|vintage|modern|century)\b/i.test(prompt);
    const periodSkipped = /לא משנה.*(?:שנה|תקופה)|אין העדפה.*(?:שנה|תקופה)|ללא העדפ.*(?:שנה|תקופה)|any (?:year|period)|no (?:year|period) preference/i.test(prompt);
    const buyerQuestions: string[] = [];
    if (!price && !budgetSkipped) buyerQuestions.push(language === 'he' ? 'מה התקציב שלך או טווח המחירים הרצוי? אפשר גם לציין שאין תקציב מוגדר.' : 'What is your budget or preferred price range? You can also say you have no fixed budget.');
    if (!periodSpecified && !periodSkipped) buyerQuestions.push(language === 'he' ? 'יש שנה או תקופה מועדפת? אפשר גם לציין שאין העדפה.' : 'Do you have a preferred year or period? You can also say you have no preference.');
    const buyerNextAction = buyerQuestions.length ? buyerQuestions.join(' ') : language === 'he' ? 'אפשר להמשיך לחיפוש לפי הפרטים שציינת.' : 'You can continue searching with the supplied criteria.';
    const hebrewItem = hasRing
      ? `טבעת${hasPink ? ' ורודה' : hasBlue ? ' כחולה' : ''}`
      : `${hasPainting ? 'ציור' : 'פריט'}${hasPink ? ' ורוד' : hasBlue ? ' כחול' : ''}`;

    const itemName = hasBlue ? 'טבעת כחולה' : 'פריט דוגמתי';
    const summary = hasBlue ? 'המשתמש מחפש פריט קשור לצבע כחול' : 'המשתמש מחפש פריט דוגמתי';
    const recommendation = hasBlue ? 'הצג פריטים דומים עם צבע כחול או בקש פרטים נוספים' : 'הצג אפשרויות נוספות ומידע נוסף';
    const nextAction = price
      ? (language === 'he' ? 'חפש פריטים מתאימים בטווח התקציב שצוין' : 'Find matching items within the provided budget.')
      : hasBlue ? 'בקש מידע נוסף על תקציב והזדמנות לרכישה' : 'בקש פרטים נוספים כדי להדריך טוב יותר';
    const confidence: FixtureProviderResponse['confidence'] = hasBlue ? 'medium' : 'low';

    const structuredAnswer = role === 'seller'
      ? (() => {
          // Tracked facts reflect only what this prompt actually mentions.
          const trackedFacts: Array<{ key: string; present: boolean }> = [
            { key: 'item title', present: hasItemType },
            { key: 'category', present: hasItemType },
            { key: 'dimensions', present: hasDimensions },
            { key: 'condition', present: hasCondition },
            { key: 'provenance', present: hasProvenance },
          ];
          const confirmedFacts = trackedFacts.filter((fact) => fact.present).map((fact) => fact.key);
          if (hasSignature) confirmedFacts.push('signature');
          const completionFields: Record<string, FieldCompletion> = {
            'item title': { required: true, status: hasItemType ? 'provided' : 'missing', value: hasItemType ? (hasPainting ? 'painting' : 'item') : null },
            category: { required: true, status: hasItemType ? 'provided' : 'missing', value: hasItemType ? (hasPainting ? 'paintings' : 'general') : null },
            dimensions: { required: true, status: hasDimensions ? 'provided' : 'missing', value: hasDimensions ? 'provided' : null },
            condition: { required: true, status: hasCondition ? 'provided' : 'missing', value: hasCondition ? 'provided' : null },
            provenance: { required: false, status: hasProvenance ? 'provided' : 'missing', value: hasProvenance ? 'provided' : null },
          };
          return {
            role: 'seller' as const,
            language,
            intent: 'Prepare an item for auction review.',
            category: hasPainting ? 'paintings' : 'general',
            item: {
              title: hasPainting ? (language === 'he' ? 'ציור כחול' : 'Blue item') : undefined,
              ...(hasDimensions ? { dimensions: 'provided' } : {}),
              ...(hasCondition ? { condition: 'provided' } : {}),
              ...(hasSignature ? { signature: 'present' } : {}),
              ...(hasProvenance ? { provenance: 'provided' } : {}),
            },
            missingFacts: trackedFacts.filter((fact) => !fact.present).map((fact) => fact.key),
            confirmedFacts,
            uncertainFacts: hasPainting ? ['title'] : [],
            sellerConfirmation: {
              required: true,
              status: 'pending' as const,
            },
            hasContactDetails: false,
            hasImages: false,
            completionState: buildCompletionState(completionFields),
          };
        })()
      : {
          role: 'buyer' as const,
          language,
          intent: hasBlue ? 'Find a blue item with a matching time period and budget.' : 'Review a general buyer request for more useful details.',
          category: hasRing ? 'rings' : hasPainting ? 'paintings' : 'general',
          ...(color ? { keywords: [color] } : {}),
          ...(hasYear ? { periods: [year] } : {}),
          ...(price ? { price } : {}),
          hasContactDetails: false,
          hasImages: false,
          completionState: buildCompletionState({
            category: { required: true, status: hasItemType ? 'provided' : 'missing', value: hasItemType ? (hasRing ? 'rings' : hasPainting ? 'paintings' : 'general') : null },
            budget: { required: false, status: price ? 'provided' : 'missing', value: price ?? null },
            period: { required: false, status: periodSpecified ? 'provided' : periodSkipped ? 'skipped' : 'missing', value: periodSpecified ? year : null },
          }),
        };

    if (language === 'en') {
      return {
        provider: 'fixture',
        mode: 'fixture',
        ...(input.fallbackMode ? { fallbackMode: input.fallbackMode } : {}),
        isRelevant,
        error,
        content: `Fixture result: ${englishItem}${hasYear ? ` from ${year}` : ''}. This is a deterministic fixture response.`,
        summary: isRelevant
          ? `You ${role === 'buyer' ? 'are looking for' : 'want to sell'} a ${englishItem}${hasYear ? ` from ${year}` : ''}.`
          : 'The request is not related to buying or selling items.',
        recommendation: role === 'buyer'
          ? `Search for matching ${englishItem} listings using the supplied criteria.`
          : 'Review and confirm the item details before comparing sales.',
        nextAction: role === 'seller'
          ? 'Provide dimensions, condition, and provenance for the item.'
          : isRelevant ? buyerNextAction : 'Describe the item you would like to buy.',
        confidence,
        structuredAnswer: {
          ...structuredAnswer,
          language: 'en',
          ...(role === 'buyer' ? {
            intent: `Find a ${englishItem} matching the supplied criteria.`,
            category: hasRing ? 'rings' : hasPainting ? 'paintings' : 'general',
          } : {}),
        },
      };
    }

    return {
      provider: 'fixture',
      mode: 'fixture',
      ...(input.fallbackMode ? { fallbackMode: input.fallbackMode } : {}),
      isRelevant,
      error,
      content: `תוצאה קבועה (fixture): ${itemName} משנת ${year}. זו תשובה דטרמיניסטית לשימוש בבדיקות ובמקרה של כשל במפרסם האמיתי.`,
      summary: role === 'buyer' && isRelevant ? `הבקשה שלך היא למצוא ${hebrewItem}${hasYear ? ` משנת ${year}` : ''}.` : summary,
      recommendation: role === 'buyer' && isRelevant ? 'נשתמש בפרטי הפריט ובהעדפות שלך כדי למקד את החיפוש.' : recommendation,
      nextAction: role === 'buyer' ? (isRelevant ? buyerNextAction : 'איזה פריט ברצונך לחפש?') : nextAction,
      confidence,
      structuredAnswer: {
        ...structuredAnswer,
        language: 'he',
        ...(role === 'buyer' ? {
          intent: `מצא ${hebrewItem} לפי הפרטים וההעדפות שסופקו.`,
          category: hasRing ? 'טבעות' : hasPainting ? 'ציורים' : 'כללי',
        } : {}),
      },
    };
  }
}
