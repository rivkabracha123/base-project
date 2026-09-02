import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

export class GenerateAiRequestDto {
  @ApiProperty({
    example: 'Find me a blue ring under $15,000 from the 1920s',
    description: 'Buyer prompt or natural-language request sent to the AI provider.',
  })
  @IsString()
  prompt!: string;

  @ApiPropertyOptional({
    enum: ['he', 'en'],
    default: 'he',
    description: 'Preferred language for the AI response.',
  })
  @IsOptional()
  @IsEnum(['he', 'en'])
  language?: 'he' | 'en';

  @ApiPropertyOptional({
    example: 'https://api.example.com/v1',
    description: 'Optional OpenAI-compatible base URL for the real provider.',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @ApiPropertyOptional({
    example: 'gpt-4o-mini',
    description: 'Optional model name for the real provider.',
  })
  @IsOptional()
  @IsString()
  modelName?: string;

  @ApiPropertyOptional({
    example: 'sk-demo-key',
    description: 'Optional API key for the real provider.',
  })
  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class GenerateAiResponseDto {
  @ApiProperty({ enum: ['fixture', 'real'] })
  provider!: 'fixture' | 'real';

  @ApiProperty({ enum: ['fixture', 'real'] })
  mode!: 'fixture' | 'real';

  @ApiProperty({ example: 'I found a blue ring...' })
  content!: string;

  @ApiProperty({ example: 'Buyer wants a blue ring under $15,000.' })
  summary!: string;

  @ApiProperty({ example: 'Ask for creator and period' })
  recommendation!: string;

  @ApiProperty({ example: 'Clarify whether the buyer prefers a maker or origin.' })
  nextAction!: string;

  @ApiProperty({ enum: ['low', 'medium'] })
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
