import { isGenerateAiResponseDto } from './ai.dto';
import { FixtureProviderService, type FixtureProviderRequest, type FixtureProviderResponse } from './fixture-provider.service';
import { RealProviderService, type RealProviderRequest, type RealProviderResponse } from './real-provider.service';
import type { AiRole } from './ai.dto';

export type ProviderConfig = {
  kind: 'fixture' | 'real';
  enabled?: boolean;
  baseUrl?: string | null;
  modelName?: string | null;
  apiKey?: string | null;
};

export type ProviderGatewayRequest = FixtureProviderRequest & {
  role?: AiRole;
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
};

//choose the provider

export type ProviderGatewayResponse = FixtureProviderResponse | RealProviderResponse;

function isValidProviderGatewayResponse(value: unknown): value is ProviderGatewayResponse {
  return isGenerateAiResponseDto(value);
}

//2 providers - fixture and real

export class ProviderGatewayService {
  constructor(
    private readonly dependencies: {
      fixtureProvider: FixtureProviderService;
      realProvider: RealProviderService;
    },
  ) {}

  //generate method that takes a prompt and returns a response

  async generate(
    input: ProviderGatewayRequest,
    configuredProviders: ProviderConfig[] = [],
  ): Promise<ProviderGatewayResponse> {
    const enabledReal = configuredProviders.find((provider) => provider.kind === 'real' && provider.enabled !== false);
    const realBaseUrl = enabledReal?.baseUrl ?? input.baseUrl;
    const realModelName = enabledReal?.modelName ?? input.modelName;
    const realApiKey = enabledReal?.apiKey ?? input.apiKey;
    const hasValidRealConfig = Boolean(realBaseUrl && realModelName && realApiKey);

    if (enabledReal && !hasValidRealConfig) {
      return this.dependencies.fixtureProvider.generate({
        prompt: input.prompt,
        role: input.role,
        language: input.language,
      });
    }

    //real provider is enabled

    if (enabledReal && hasValidRealConfig) {
      const realRequest: RealProviderRequest = {
        ...input,
        baseUrl: realBaseUrl,
        modelName: realModelName,
        apiKey: realApiKey,
      };

      try {
        const result = await this.dependencies.realProvider.generate(realRequest);

        if (!isValidProviderGatewayResponse(result)) {
          throw new Error('Real provider returned a malformed response payload.');
        }

        return result;
      } catch (error) {
        const fallback = this.dependencies.fixtureProvider.generate({
          prompt: input.prompt,
          role: input.role,
          language: input.language,
        });

        return await fallback;
      }
    }

    return this.dependencies.fixtureProvider.generate({
      prompt: input.prompt,
      role: input.role,
      language: input.language,
    });
  }
}
