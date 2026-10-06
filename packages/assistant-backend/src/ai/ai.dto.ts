import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { isBuyerHandoffContract, type BuyerHandoffContract } from './buyer-handoff';

export class GenerateAiRequestDto {
  @IsString()
  prompt!: string;

  @IsOptional()
  @IsEnum(['he', 'en'])
  language?: 'he' | 'en';

}

//shape buyer answer that the AI get

export type StructuredBuyerAnswer = BuyerHandoffContract;

//shape of the response that AI return
export class GenerateAiResponseDto {
  provider!: 'fixture' | 'real';

  mode!: 'fixture' | 'real';

  content!: string;

  summary!: string;

  recommendation!: string;

  nextAction!: string;

  confidence!: 'low' | 'medium';

  structuredAnswer!: StructuredBuyerAnswer;
}

//check if the response is valid and has the correct shape
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

  return isBuyerHandoffContract(response.structuredAnswer);
}
