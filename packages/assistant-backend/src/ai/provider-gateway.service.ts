import { Logger } from '@nestjs/common';
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

function isValidProviderGatewayResponse(value: unknown, expectedRole?: AiRole): value is ProviderGatewayResponse {
  return isGenerateAiResponseDto(value, expectedRole);
}

// Only a coarse reason is logged; provider messages may echo user content.
export function classifyProviderFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const status = message.match(/request failed: (\d{3})/)?.[1];
  if (status) return `http_${status}`;
  if (/schema validation|malformed|non-JSON|no content|restricted/i.test(message)) return 'invalid_response';
  return 'unavailable';
}

//2 providers - fixture and real

export class ProviderGatewayService {
  private readonly logger = new Logger(ProviderGatewayService.name);

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
        fallbackMode: 'guided',
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
        let result: ProviderGatewayResponse | undefined;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const candidate = await this.dependencies.realProvider.generate(realRequest);
            if (!isValidProviderGatewayResponse(candidate, input.role)) {
              throw new Error('Real provider returned a malformed response payload.');
            }
            result = candidate;
            break;
          } catch (error) {
            this.logger.warn(`Real provider attempt ${attempt + 1} failed: ${classifyProviderFailure(error)}`);
            if (attempt === 1) {
              throw error;
            }
          }
        }

        return result!;
      } catch (error) {
        this.logger.warn(`Falling back to guided input: ${classifyProviderFailure(error)}`);
        const fallback = this.dependencies.fixtureProvider.generate({
          prompt: input.prompt,
          role: input.role,
          language: input.language,
          fallbackMode: 'guided',
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
