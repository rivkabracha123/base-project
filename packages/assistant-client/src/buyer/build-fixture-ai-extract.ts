/** Minimal AiExtract body for dev until P4 wires the real provider on the client. */
export type FixtureAiExtractResponse = {
  provider: 'fixture';
  mode: 'fixture';
  content: string;
  summary: string;
  recommendation: string;
  nextAction: string;
  confidence: 'low' | 'medium' | 'high';
  isRelevant?: boolean;
  error?: string | null;
};

export function buildFixtureAiExtractFromBuyerMessage(
  message: string,
  language: 'he' | 'en',
): FixtureAiExtractResponse {
  return {
    provider: 'fixture',
    mode: 'fixture',
    content: message,
    summary: language === 'he' ? 'בקשת קונה (fixture)' : 'Buyer request (fixture)',
    recommendation: language === 'he' ? 'המשך שאלות' : 'Continue clarification',
    nextAction: language === 'he' ? 'שאל על חסר' : 'Ask missing facts',
    confidence: 'medium',
  };
}
