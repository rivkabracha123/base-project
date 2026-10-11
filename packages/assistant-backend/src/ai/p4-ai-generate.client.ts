import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { detectBuyerLanguage, type AiExtractResponse } from '../buyer/buyer-criteria';
import { B2_SEARCH_LOTS_FUNCTION } from './p4-buyer-routing';
import { buildFixtureAiExtract } from './fixture-ai-extract';
import type { P4AiGenerateResponse, P4IntentRoute, ShilatAiGenerateRequest } from './p4-ai.types';
import type { ShilatSellerGenerateResponse } from './p4-ai.types';
import { isSellerHandoffContract } from './seller-handoff';
import { P4_SEARCH_READINESS_PROBE_MESSAGE } from './p4-ai.types';

function fixtureExtract(request: ShilatAiGenerateRequest): AiExtractResponse {
  const language = request.language ?? detectBuyerLanguage(request.prompt);
  return buildFixtureAiExtract(request.prompt, language);
}

function readIntentRoute(record: Record<string, unknown>): P4IntentRoute {
  const raw =
    record.intentRoute && typeof record.intentRoute === 'object'
      ? (record.intentRoute as Record<string, unknown>)
      : record;

  const functionName =
    typeof raw.functionName === 'string'
      ? raw.functionName
      : typeof record.functionName === 'string'
        ? record.functionName
        : typeof record.function === 'string'
          ? record.function
          : null;

  const intent = typeof raw.intent === 'string' ? raw.intent : null;
  const readyForFunction = typeof raw.readyForFunction === 'boolean'
    ? raw.readyForFunction
    : record.readyForFunction === true || record.ready === true;
  const missingFields = Array.isArray(raw.missingFields)
    ? raw.missingFields.filter((f): f is string => typeof f === 'string')
    : undefined;
  const argsRaw = raw.arguments ?? record.arguments;
  const arguments_ =
    argsRaw && typeof argsRaw === 'object' && !Array.isArray(argsRaw)
      ? (argsRaw as Record<string, unknown>)
      : undefined;

  return {
    intent,
    functionName,
    readyForFunction,
    missingFields,
    arguments: arguments_,
  };
}

function normalizeExtract(record: Record<string, unknown>, fallback: AiExtractResponse): AiExtractResponse {
  if (record.extract && typeof record.extract === 'object') {
    return record.extract as AiExtractResponse;
  }

  if (typeof record.content !== 'string') {
    return fallback;
  }

  const provider = record.provider === 'real' ? 'real' : 'fixture';
  const mode = record.mode === 'real' ? 'real' : 'fixture';
  const confidence: AiExtractResponse['confidence'] =
    record.confidence === 'medium' ? 'medium' : 'low';

  return {
    provider,
    mode,
    isRelevant: record.isRelevant !== false,
    error: typeof record.error === 'string' ? record.error : record.error === null ? null : undefined,
    content: record.content,
    summary: typeof record.summary === 'string' ? record.summary : '',
    recommendation: typeof record.recommendation === 'string' ? record.recommendation : '',
    nextAction: typeof record.nextAction === 'string' ? record.nextAction : '',
    confidence,
    structuredAnswer:
      record.structuredAnswer && typeof record.structuredAnswer === 'object'
        ? (record.structuredAnswer as AiExtractResponse['structuredAnswer'])
        : undefined,
  };
}

function readFunctionParameters(record: Record<string, unknown>, route: P4IntentRoute): Record<string, unknown> | null {
  const raw = record.functionParameters ?? record.parameters ?? record.payload ?? route.arguments;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function normalizeP4Response(body: unknown, fallbackExtract: AiExtractResponse): P4AiGenerateResponse {
  if (!body || typeof body !== 'object') {
    return {
      extract: fallbackExtract,
      readyForFunction: false,
      intentRoute: { functionName: null, readyForFunction: false },
      functionParameters: null,
    };
  }

  const record = body as Record<string, unknown>;
  const intentRoute = readIntentRoute(record);
  const extract = normalizeExtract(record, fallbackExtract);
  const readyForFunction = intentRoute.readyForFunction;

  return {
    extract,
    readyForFunction,
    intentRoute: { ...intentRoute, readyForFunction },
    functionParameters: readFunctionParameters(record, intentRoute),
  };
}

@Injectable()
export class P4AiGenerateClient {
  constructor(private readonly config: ConfigService) {}

  async generateBuyerExtract(request: ShilatAiGenerateRequest): Promise<P4AiGenerateResponse> {
    const mode = this.config.get<string>('AI_PROVIDER_MODE') ?? 'fixture';
    const fallback = fixtureExtract(request);

    if (mode !== 'real') {
      const readinessProbe = request.prompt === P4_SEARCH_READINESS_PROBE_MESSAGE ||
        request.prompt.startsWith(`${P4_SEARCH_READINESS_PROBE_MESSAGE}\n`);
      return {
        extract: fallback,
        readyForFunction: readinessProbe,
        intentRoute: readinessProbe
          ? { functionName: B2_SEARCH_LOTS_FUNCTION, readyForFunction: true }
          : { functionName: null, readyForFunction: false },
        functionParameters: readinessProbe ? { sessionId: request.sessionId ?? null } : null,
      };
    }

    const url = this.config.get<string>('AI_GENERATE_URL');
    if (!url) {
      throw new ServiceUnavailableException(
        'AI_PROVIDER_MODE is real but AI_GENERATE_URL is not configured.',
      );
    }

    const apiKey = this.config.get<string>('AI_GENERATE_API_KEY');
    const anonymousSessionId =
      request.sessionId?.trim() ||
      this.config.get<string>('AI_ANONYMOUS_SESSION_ID') ||
      'buyer-b2-dev-session';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-anonymous-session-id': anonymousSessionId,
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    // Shilat W5 POST /api/ai/generate requires role; extra fields forward when her DTO adds them.
    const wireBody: ShilatAiGenerateRequest & { role: 'buyer' } = {
      role: 'buyer',
      prompt: request.prompt,
      language: request.language,
      sessionId: request.sessionId,
      selectedLot: request.selectedLot ?? null,
      lots: request.lots,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(wireBody),
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

  async generateSellerExtract(request: ShilatAiGenerateRequest): Promise<ShilatSellerGenerateResponse> {
    const mode = this.config.get<string>('AI_PROVIDER_MODE') ?? 'fixture';
    if (mode !== 'real') {
      throw new ServiceUnavailableException(
        'Seller extraction requires the real P4 AI provider.',
      );
    }

    const url = this.config.get<string>('AI_GENERATE_URL');
    if (!url) {
      throw new ServiceUnavailableException(
        'AI_PROVIDER_MODE is real but AI_GENERATE_URL is not configured.',
      );
    }

    const anonymousSessionId =
      request.sessionId?.trim() ||
      this.config.get<string>('AI_ANONYMOUS_SESSION_ID') ||
      'seller-dev-session';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-anonymous-session-id': anonymousSessionId,
    };
    const apiKey = this.config.get<string>('AI_GENERATE_API_KEY');
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        role: 'seller',
        prompt: request.prompt,
        language: request.language,
        sessionId: request.sessionId,
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(`Seller AI extraction failed with status ${response.status}.`);
    }

    const body = await response.json() as Record<string, unknown>;
    const nestedExtract = body.extract && typeof body.extract === 'object'
      ? body.extract as Record<string, unknown>
      : undefined;
    const structuredAnswer = body.structuredAnswer ?? nestedExtract?.structuredAnswer;
    if (!isSellerHandoffContract(structuredAnswer)) {
      throw new ServiceUnavailableException('Seller AI returned an invalid handoff contract.');
    }

    return {
      provider: 'real',
      mode: 'real',
      isRelevant: body.isRelevant !== false,
      error: typeof body.error === 'string' ? body.error : null,
      content: typeof body.content === 'string' ? body.content : '',
      summary: typeof body.summary === 'string' ? body.summary : '',
      recommendation: typeof body.recommendation === 'string' ? body.recommendation : '',
      nextAction: typeof body.nextAction === 'string' ? body.nextAction : '',
      confidence: body.confidence === 'medium' ? 'medium' : 'low',
      structuredAnswer,
      ...(body.functionCall !== undefined ? { functionCall: body.functionCall as ShilatSellerGenerateResponse['functionCall'] } : {}),
    };
  }
}
