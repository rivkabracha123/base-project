import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isGenerateAiResponseDto } from './ai.dto';
import { FixtureProviderService } from './fixture-provider.service';
import { classifyProviderFailure, ProviderGatewayService } from './provider-gateway.service';
import { RealProviderService } from './real-provider.service';
import { routeBuyerIntent, type IntentRoute } from './intent-router';
import { ProfilesService } from '../profiles/profiles.service';
import type { AiFunctionCall, AiRole, StructuredAnswer } from './ai.dto';

//request
export type AiGenerateRequest = {
  prompt: string;
  role?: AiRole;
  language?: 'he' | 'en';
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
  sessionId?: string;
  history?: Array<{ prompt: string; answer: string }>;
  selectedLot?: Record<string, unknown> | null;
  lots?: unknown[];
};

//response
export type AiGenerateResponse = {
  provider: 'fixture' | 'real';
  mode: 'fixture' | 'real';
  fallbackMode?: 'guided';
  isRelevant: boolean;
  error: string | null;
  content: string;
  summary: string;
  recommendation: string;
  nextAction: string;
  confidence: 'low' | 'medium';
  structuredAnswer: StructuredAnswer;
  intentRoute?: IntentRoute;
  functionCall?: AiFunctionCall | null;
};

//constructor
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly fixtureProvider: FixtureProviderService,
    private readonly realProvider: RealProviderService,
    private readonly config: ConfigService,
    private readonly profilesService: ProfilesService,
  ) {}

  async generateText(input: { prompt: string; language?: 'he' | 'en' }): Promise<string> {
    if (this.config.get<string>('AI_PROVIDER_MODE', 'fixture') !== 'real') {
      throw new ServiceUnavailableException('Free-text generation needs the real AI provider.');
    }
    try {
      return await this.realProvider.generateText({
        ...input,
        baseUrl: this.config.get<string>('AI_BASE_URL'),
        modelName: this.config.get<string>('AI_MODEL_NAME'),
        apiKey: this.config.get<string>('AI_API_KEY'),
      });
    } catch (error) {
      this.logger.warn(`Free-text generation failed: ${classifyProviderFailure(error)}`);
      throw new ServiceUnavailableException('Real AI provider is unavailable.');
    }
  }

  async generate(input: AiGenerateRequest): Promise<AiGenerateResponse> {
    if (input.sessionId && (input.role ?? 'buyer') === 'buyer') {
      await this.profilesService.captureContactIfPresent(input.sessionId, input.prompt);
    }

    const gateway = new ProviderGatewayService({
      fixtureProvider: this.fixtureProvider,
      realProvider: this.realProvider,
    });

    const configuredProviders = [
      { kind: 'fixture' as const, enabled: true },
      {
        kind: 'real' as const,
        enabled: this.config.get<string>('AI_PROVIDER_MODE', 'fixture') === 'real',
        baseUrl: this.config.get<string>('AI_BASE_URL'),
        modelName: this.config.get<string>('AI_MODEL_NAME'),
        apiKey: this.config.get<string>('AI_API_KEY'),
      },
    ];

    //send a prompt and make sure that the result equals the provider shape

    const result = await gateway.generate({ ...input, role: input.role ?? 'buyer' }, configuredProviders);

    if (!isGenerateAiResponseDto(result, input.role ?? 'buyer')) {
      throw new Error('AI service received an invalid response shape from the provider gateway.');
    }

    const role = input.role ?? 'buyer';
    const intentRoute = role === 'buyer'
      ? routeBuyerIntent(input.prompt, {
          language: input.language,
          sessionId: input.sessionId,
          selectedLot: input.selectedLot ?? undefined,
          lots: input.lots,
          ...(result.structuredAnswer.role === 'buyer' ? {
            category: result.structuredAnswer.category,
            geography: result.structuredAnswer.geography?.join(', '),
            completionState: result.structuredAnswer.completionState,
          } : {}),
        })
      : undefined;

    return {
      ...result,
      ...(intentRoute?.intent === 'buyer_house_ranking' ? { isRelevant: true } : {}),
      ...(intentRoute && intentRoute.intent !== 'unknown' ? { intentRoute } : {}),
    };
  }
}
