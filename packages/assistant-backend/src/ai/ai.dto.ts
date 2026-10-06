import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

class AiGenerateLotRefDto {
  @IsString()
  id!: string;
}
import { isBuyerHandoffContract, type BuyerHandoffContract } from './buyer-handoff';
import { isSellerHandoffContract, type SellerHandoffContract } from './seller-handoff';
import type { IntentRoute } from './intent-router';

export type AiRole = 'buyer' | 'seller';

export class GenerateAiRequestDto {
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsString()
  prompt!: string;

  @IsEnum(['buyer', 'seller'])
  role!: AiRole;

  @IsOptional()
  @IsEnum(['he', 'en'])
  language?: 'he' | 'en';

  /** Forwarded from B2 buyer bridge; session is also taken from x-anonymous-session-id when present. */
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiGenerateLotRefDto)
  selectedLot?: AiGenerateLotRefDto | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiGenerateLotRefDto)
  lots?: AiGenerateLotRefDto[];
}

//shape buyer answer that the AI get

export type StructuredAnswer = BuyerHandoffContract | SellerHandoffContract;

//shape of the response that AI return
export class GenerateAiResponseDto {
  provider!: 'fixture' | 'real';

  mode!: 'fixture' | 'real';

  fallbackMode?: 'guided';

  isRelevant!: boolean;

  error!: string | null;

  content!: string;

  summary!: string;

  recommendation!: string;

  nextAction!: string;

  confidence!: 'low' | 'medium';

  structuredAnswer!: StructuredAnswer;

  intentRoute?: IntentRoute;
}

//check if the response is valid and has the correct shape
export function isGenerateAiResponseDto(value: unknown, expectedRole?: AiRole): value is GenerateAiResponseDto {
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

  if (response.fallbackMode !== undefined && response.fallbackMode !== 'guided') {
    return false;
  }

  if (typeof response.isRelevant !== 'boolean') {
    return false;
  }

  if (response.error !== null && typeof response.error !== 'string') {
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

  if (response.intentRoute !== undefined && !isIntentRoute(response.intentRoute)) {
    return false;
  }
  const structuredAnswer = response.structuredAnswer;
  if (
    expectedRole &&
    (!structuredAnswer || typeof structuredAnswer !== 'object' || (structuredAnswer as { role?: unknown }).role !== expectedRole)
  ) {
    return false;
  }

  return isBuyerHandoffContract(structuredAnswer) || isSellerHandoffContract(structuredAnswer);
}

function isIntentRoute(value: unknown): value is IntentRoute {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const route = value as Record<string, unknown>;
  const intents = ['get_lot_details', 'same_item_sale_history', 'search_similar_lots', 'search_auction_lots', 'unknown'];
  const functions = ['getLotById', 'getComparableSaleHistory'];
  return intents.includes(String(route.intent)) &&
    (route.functionName === null || (typeof route.functionName === 'string' && functions.includes(route.functionName))) &&
    typeof route.readyForFunction === 'boolean' &&
    Array.isArray(route.missingFields) && route.missingFields.every(field => typeof field === 'string') &&
    Boolean(route.arguments) && typeof route.arguments === 'object' && !Array.isArray(route.arguments);
}
