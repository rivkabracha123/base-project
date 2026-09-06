import { Injectable } from '@nestjs/common';
import { isGenerateAiResponseDto } from './ai.dto';
import { FixtureProviderService } from './fixture-provider.service';
import { ProviderGatewayService } from './provider-gateway.service';
import { RealProviderService } from './real-provider.service';

export type AiGenerateRequest = {
  prompt: string;
  language?: 'he' | 'en';
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
};

export type AiGenerateResponse = {
  provider: 'fixture' | 'real';
  mode: 'fixture' | 'real';
  content: string;
  summary: string;
  recommendation: string;
  nextAction: string;
  confidence: 'low' | 'medium';
  structuredAnswer: {
    language: 'he' | 'en';
    intent: string;
    category: string;
    missingFacts: string[];
    hasContactDetails: boolean;
    hasImages: boolean;
  };
};

//constructor

@Injectable()
export class AiService {
  constructor(
    private readonly fixtureProvider: FixtureProviderService,
    private readonly realProvider: RealProviderService,
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
        enabled: true,
        baseUrl: input.baseUrl,
        modelName: input.modelName,
        apiKey: input.apiKey,
      },
    ];

    //send a prompt and make sure that the result equals the provider shape

    const result = await gateway.generate(input, configuredProviders);

    if (!isGenerateAiResponseDto(result)) {
      throw new Error('AI service received an invalid response shape from the provider gateway.');
    }

    return result;
  }
}
