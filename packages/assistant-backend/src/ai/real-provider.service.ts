import { isGenerateAiResponseDto, type AiRole, type StructuredAnswer } from './ai.dto';

export type RealProviderRequest = {
  prompt: string;
  role?: AiRole;
  language?: 'he' | 'en';
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

export type RealProviderResponse = {
  provider: 'real';
  mode: 'real';
  fallbackMode?: 'guided';
  isRelevant: boolean;
  error: string | null;
  content: string;
  summary: string;
  recommendation: string;
  nextAction: string;
  confidence: 'low' | 'medium';
  structuredAnswer: StructuredAnswer;
};

export function sanitizePrompt(prompt: string): string {
  return prompt
    .replace(/data:image\/[a-z0-9.+-]+;base64,[^\s]+/gi, '[image removed]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[contact removed]')
    .replace(/(?<!\d)\+?\d[\d\s().-]{6,}\d(?!\d)/g, '[contact removed]');
}

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
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Return JSON matching the validated ${input.role ?? 'buyer'} handoff contract. Do not include contact details or image data.`,
          },
          {
            role: 'user',
            content: sanitizePrompt(input.prompt),
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

    const message = data.choices?.[0]?.message?.content;
    if (!message) {
      throw new Error('Real provider returned no content.');
    }

    let parsed: Omit<RealProviderResponse, 'provider' | 'mode' | 'content'>;
    try {
      parsed = JSON.parse(message) as Omit<RealProviderResponse, 'provider' | 'mode' | 'content'>;
    } catch {
      throw new Error('Real provider returned non-JSON content.');
    }

    const result: unknown = {
      provider: 'real',
      mode: 'real',
      isRelevant: parsed.isRelevant,
      error: parsed.error,
      content: message,
      summary: parsed.summary,
      recommendation: parsed.recommendation,
      nextAction: parsed.nextAction,
      confidence: parsed.confidence,
      structuredAnswer: parsed.structuredAnswer,
    };

    if (!isGenerateAiResponseDto(result) || result.provider !== 'real' || result.mode !== 'real') {
      throw new Error('Real provider returned a response that failed schema validation.');
    }

    return result as RealProviderResponse;
  }
}
