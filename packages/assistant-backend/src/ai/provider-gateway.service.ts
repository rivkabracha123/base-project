import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { isGenerateAiResponseDto } from './ai.dto';
import { FixtureProviderService, type FixtureProviderRequest, type FixtureProviderResponse } from './fixture-provider.service';
import { RealProviderService, type RealProviderRequest, type RealProviderResponse } from './real-provider.service';
import type { AiRole } from './ai.dto';
import { isExplicitlyOffTopic, offTopicCopy } from './off-topic';

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
  const schemaReason = message.match(/schema validation: ([a-z0-9_]+)/i)?.[1];
  if (schemaReason) return `invalid_response_${schemaReason.toLowerCase()}`;
  if (/non-JSON/i.test(message)) return 'invalid_response_non_json';
  if (/restricted/i.test(message)) return 'invalid_response_restricted';
  if (/no content/i.test(message)) return 'invalid_response_no_content';
  if (/malformed/i.test(message)) return 'invalid_response_malformed';
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

    if (isExplicitlyOffTopic(input.prompt)) {
      const turns = input.history ?? [];
      const previous = await this.dependencies.fixtureProvider.generate({
        role: input.role, language: input.language,
        prompt: turns.at(-1)?.prompt ?? '', history: turns.slice(0, -1),
      });
      const copy = offTopicCopy(input.language ?? 'he');
      return { ...previous, ...copy, content: copy.summary, isRelevant: false, error: null };
    }

    const realBaseUrl = enabledReal?.baseUrl ?? input.baseUrl;
    const realModelName = enabledReal?.modelName ?? input.modelName;
    const realApiKey = enabledReal?.apiKey ?? input.apiKey;
    const hasValidRealConfig = Boolean(realBaseUrl && realModelName && realApiKey);

    if (enabledReal && !hasValidRealConfig) {
      throw new ServiceUnavailableException('Real AI provider is enabled but not fully configured.');
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
            if (attempt === 1 || classifyProviderFailure(error) === 'http_429') {
              throw error;
            }
          }
        }

        if (!result!.isRelevant) {
          const copy = offTopicCopy(input.language ?? 'he');
          return { ...result!, ...copy, content: copy.summary, error: null };
        }
        return result!;
      } catch (error) {
        this.logger.warn(`Falling back to guided input: ${classifyProviderFailure(error)}`);
        throw new ServiceUnavailableException('Real AI provider is unavailable.');
      }
    }

    return this.dependencies.fixtureProvider.generate({
      prompt: input.prompt,
      history: input.history,
      role: input.role,
      language: input.language,
    });
  }
}
