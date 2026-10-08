import type { AiExtractResponse, BuyerLanguage } from '../buyer/buyer-criteria';

/** Deterministic P4 substitute when AI_PROVIDER_MODE is fixture. */
export function buildFixtureAiExtract(content: string, language: BuyerLanguage): AiExtractResponse {
  return {
    provider: 'fixture',
    mode: 'fixture',
    content,
    summary: language === 'he' ? 'בקשת קונה (fixture)' : 'Buyer request (fixture)',
    recommendation: language === 'he' ? 'המשך שאלות' : 'Continue clarification',
    nextAction: language === 'he' ? 'שאל על חסר' : 'Ask missing facts',
    confidence: 'medium',
  };
}
