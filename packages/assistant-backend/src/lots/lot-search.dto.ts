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
  ValidateBy,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
} from 'class-validator';

// `@IsISO8601` rejects impossible dates; `@Matches` rejects any time component.
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Rejects a price window whose lower bound is above its upper bound, instead of
// guessing which one the buyer meant.
const MinNotAboveMax = () =>
  ValidateBy({
    name: 'minNotAboveMax',
    validator: {
      validate: (max: unknown, args?: ValidationArguments) => {
        const min = (args?.object as { min?: unknown }).min;
        return typeof max !== 'number' || typeof min !== 'number' || min <= max;
      },
      defaultMessage: () => 'min must not be greater than max',
    },
  });

/**
 * Inclusive price window. Amounts are compared as-is: `currency` must be a
 * canonical ISO 4217 code (anything else is rejected rather than guessed), but it
 * is not used to convert amounts or to exclude lots priced in another currency.
 */
export class PriceRangeDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsNumber()
  @Min(0)
  min?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsNumber()
  @Min(0)
  @MinNotAboveMax()
  max?: number;

  @ValidateIf((_, value) => value !== undefined)
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
  @IsArray()
  @IsString({ each: true })
  geography?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  media?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(['sold', 'unsold', 'upcoming', 'withdrawn', 'unknown'], { each: true })
  statuses?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  periods?: string[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DateRangeDto)
  dateRange?: DateRangeDto;

  @ValidateIf((_, value) => value !== undefined)
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
  
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  query?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['en', 'he'])
  language?: 'en' | 'he';

  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => LotFiltersDto)
  filters?: LotFiltersDto;
}
