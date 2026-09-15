import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

// `@IsISO8601` rejects impossible dates; `@Matches` rejects any time component.
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Inclusive price window in a single currency. There is no currency conversion,
 * so a lot priced in another currency falls outside this filter. `currency` must
 * be a canonical ISO 4217 code; anything else is rejected rather than guessed.
 */
export class PriceRangeDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  min?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a canonical ISO 4217 code (e.g. USD)' })
  currency?: string;
}

/** Inclusive sale-date window. Either bound may stand alone (open-ended). */
export class DateRangeDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(CALENDAR_DATE, { message: 'from must be a YYYY-MM-DD date' })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(CALENDAR_DATE, { message: 'to must be a YYYY-MM-DD date' })
  to?: string;
}

/**
 * Structured narrowing applied alongside the free-text `query`. Only supported
 * facets are declared; the validation pipe's `forbidNonWhitelisted` rejects any
 * other key, so an unsupported filter is never silently ignored. Within one list
 * facet the values match any; separate facets must all match.
 */
export class LotFiltersDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  creators?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  auctionHouseIds?: string[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DateRangeDto)
  dateRange?: DateRangeDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PriceRangeDto)
  price?: PriceRangeDto;
}

/**
 * Request body for `POST /api/lots/search`. `query` is the free-text term;
 * `filters` is the structured narrowing. A search may carry either, both, or
 * neither. Field names and nesting match the buyer-criteria contract in
 * docs/index.html so the caller's criteria pass through without remapping.
 */
export class LotSearchDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsIn(['en', 'he'])
  language?: 'en' | 'he';

  // No default here — the service is the single source of truth for pagination.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LotFiltersDto)
  filters?: LotFiltersDto;
}
