export type RealProviderRequest = {
  prompt: string;
  language?: 'he' | 'en';
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

export type RealProviderResponse = {
  provider: 'real';
  mode: 'real';
  content: string;
  summary: string;
  recommendation: string;
  nextAction: string;
  confidence: 'low' | 'medium';
};
//inser the input to AI provider

//option to switch between the mock and fetch for test

export class RealProviderService {
  async generate(input: RealProviderRequest): Promise<RealProviderResponse> {
    const baseUrl = input.baseUrl;
    const modelName = input.modelName;
    const apiKey = input.apiKey;
    const fetchImpl = input.fetchImpl ?? fetch;

    if (!baseUrl || !modelName || !apiKey) {
      throw new Error('Real provider is not configured. Set baseUrl, modelName, and apiKey.');
    }

    //sent the actual request to the real provider
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'user',
            content: input.prompt,
          },
        ],
      }),
    });
        //sent the actual request to AI provider

    // Check if the request was successful
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Real provider request failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const message = data.choices?.[0]?.message?.content ?? 'No content returned';
    const prompt = input.prompt ?? '';
    const normalizedPrompt = prompt.toLowerCase();
    const hasBlue = normalizedPrompt.includes('כחולה') || normalizedPrompt.includes('blue');
    const confidence: RealProviderResponse['confidence'] = hasBlue ? 'medium' : 'low';

    return {
      provider: 'real',
      mode: 'real',
      content: message,
      summary: hasBlue ? 'המשתמש מחפש פריט קשור לצבע כחול' : 'המשתמש סיפק בקשה כללית',
      recommendation: hasBlue ? 'הצג פריטים דומים עם צבע כחול או בקש פרטים נוספים' : 'הצג אפשרויות רלוונטיות נוספות',
      nextAction: hasBlue ? 'בקש מידע נוסף על תקציב או שנת ייצור' : 'בקש פרטים נוספים כדי להדריך טוב יותר',
      confidence,
    };
  }
}
