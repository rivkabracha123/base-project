import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

export class GenerateAiRequestDto {
  @IsString()
  prompt!: string;

  @IsOptional()
  @IsEnum(['he', 'en'])
  language?: 'he' | 'en';

  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class GenerateAiResponseDto {
  provider!: 'fixture' | 'real';

  mode!: 'fixture' | 'real';

  content!: string;

  summary!: string;

  recommendation!: string;

  nextAction!: string;

  confidence!: 'low' | 'medium';
}

//validate the response shape from the provider gateway

export function isGenerateAiResponseDto(value: unknown): value is GenerateAiResponseDto {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const response = value as Record<string, unknown>;

  if (response.provider !== 'fixture' && response.provider !== 'real') {
    return false;
  }

  if (response.mode !== 'fixture' && response.mode !== 'real') {
    return false;
  }

  if (typeof response.content !== 'string' || response.content.trim().length === 0) {
    return false;
  }

  if (typeof response.summary !== 'string' || response.summary.trim().length === 0) {
    return false;
  }

  if (typeof response.recommendation !== 'string' || response.recommendation.trim().length === 0) {
    return false;
  }

  if (typeof response.nextAction !== 'string' || response.nextAction.trim().length === 0) {
    return false;
  }

  if (response.confidence !== 'low' && response.confidence !== 'medium') {
    return false;
  }

  return true;
}
