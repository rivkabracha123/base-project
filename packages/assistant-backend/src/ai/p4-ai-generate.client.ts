import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiExtractResponse } from '../buyer/buyer-criteria';
import type { P4AiGenerateRequest, P4AiGenerateResponse, P4IntentRoute } from './p4-ai.types';

function detectLanguage(message: string, hint?: 'he' | 'en'): 'he' | 'en' {
  if (hint) return hint;
  return /[\u0590-\u05FF]/.test(message) ? 'he' : 'en';
}

function fixtureExtract(request: P4AiGenerateRequest): AiExtractResponse {
  const language = detectLanguage(request.userMessage, request.language);
  return {
    provider: 'fixture',
    mode: 'fixture',
    content: request.userMessage,
    summary: language === 'he' ? 'בקשת קונה (fixture)' : 'Buyer request (fixture)',
    recommendation: language === 'he' ? 'המשך שאלות' : 'Continue clarification',
    nextAction: language === 'he' ? 'שאל על חסר' : 'Ask missing facts',
    confidence: 'medium',
  };
}

function normalizeIntentRoute(raw: unknown, readyForFunction: boolean): P4IntentRoute {
  if (!raw || typeof raw !== 'object') {
    return { functionName: null, readyForFunction };
  }
  const route = raw as Record<string, unknown>;
  const functionName = typeof route.functionName === 'string' ? route.functionName : null;
  const ready =
    typeof route.readyForFunction === 'boolean' ? route.readyForFunction : readyForFunction;
  return { functionName, readyForFunction: ready };
}

function normalizeP4Response(body: unknown, fallbackExtract: AiExtractResponse): P4AiGenerateResponse {
  if (!body || typeof body !== 'object') {
    return {
      extract: fallbackExtract,
      readyForFunction: false,
      intentRoute: { functionName: null, readyForFunction: false },
    };
  }

  const record = body as Record<string, unknown>;
  const readyForFunction = record.readyForFunction === true;
  const extract =
    record.extract && typeof record.extract === 'object'
      ? (record.extract as AiExtractResponse)
      : fallbackExtract;

  return {
    extract,
    readyForFunction,
    intentRoute: normalizeIntentRoute(record.intentRoute, readyForFunction),
  };
}

@Injectable()
export class P4AiGenerateClient {
  constructor(private readonly config: ConfigService) {}

  async generateBuyerExtract(request: P4AiGenerateRequest): Promise<P4AiGenerateResponse> {
    const mode = this.config.get<string>('AI_PROVIDER_MODE') ?? 'fixture';
    const fallback = fixtureExtract(request);

    if (mode !== 'real') {
      const readinessProbe = request.userMessage.includes('Evaluate readiness for search');
      return {
        extract: fallback,
        readyForFunction: readinessProbe,
        intentRoute: readinessProbe
          ? { functionName: 'searchLots', readyForFunction: true }
          : { functionName: null, readyForFunction: false },
      };
    }

    const url = this.config.get<string>('AI_GENERATE_URL');
    if (!url) {
      throw new ServiceUnavailableException(
        'AI_PROVIDER_MODE is real but AI_GENERATE_URL is not configured.',
      );
    }

    const apiKey = this.config.get<string>('AI_GENERATE_API_KEY');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });
    } catch {
      throw new ServiceUnavailableException('AI generate request failed.');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(`AI generate failed with status ${response.status}.`);
    }

    const body: unknown = await response.json();
    return normalizeP4Response(body, fallback);
  }
}
