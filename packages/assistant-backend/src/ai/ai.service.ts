import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isGenerateAiResponseDto } from './ai.dto';
import { FixtureProviderService } from './fixture-provider.service';
import { ProviderGatewayService } from './provider-gateway.service';
import { RealProviderService } from './real-provider.service';
import type { AiRole, StructuredAnswer } from './ai.dto';

//request
export type AiGenerateRequest = {
  prompt: string;
  role?: AiRole;
  language?: 'he' | 'en';
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
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
};

//constructor
@Injectable()
export class AiService {
  constructor(
    private readonly fixtureProvider: FixtureProviderService,
    private readonly realProvider: RealProviderService,
    private readonly config: ConfigService,
  ) {}

  async generate(input: AiGenerateRequest): Promise<AiGenerateResponse> {
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

    if (!isGenerateAiResponseDto(result)) {
      throw new Error('AI service received an invalid response shape from the provider gateway.');
    }

    return result;
  }
}
