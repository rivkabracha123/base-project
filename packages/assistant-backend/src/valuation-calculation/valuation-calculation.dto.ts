// Defines the rules the global ValidationPipe (main.ts) uses to parse and check incoming requests; it does not run them itself.
import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsIn, IsISO8601, IsNotEmpty, IsNumber, IsPositive, IsString, Matches, Max, Min, ValidateIf, ValidateNested } from 'class-validator';

// Shape of one comparable sale inside the request body; every field is checked before it reaches the service.
export class ComparableSaleDto {
  @IsString()
  @Matches(/\S/)
  id!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true })
  saleDate!: string;

  @IsNumber()
  @IsPositive()
  soldPrice!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  weight!: number;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @IsString()
  category!: string;

  @IsIn(['sold', 'unsold', 'upcoming'])
  status!: 'sold' | 'unsold' | 'upcoming';

  @IsString()
  source!: string;
}

// Shape of the full POST /valuation-calculation/valuation request body.
export class ValuationInputDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  itemId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  itemVersion!: string;

  // @Type + @ValidateNested convert and validate each array item as a ComparableSaleDto, not just the array itself.
  @IsArray()
  @ArrayUnique((sale: ComparableSaleDto | null) => sale?.id)
  @ValidateNested({ each: true })
  @Type(() => ComparableSaleDto)
  comparables!: ComparableSaleDto[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayUnique((entry: ExcludedComparableDto | null) => entry?.id)
  @ValidateNested({ each: true })
  @Type(() => ExcludedComparableDto)
  excludedComparables?: ExcludedComparableDto[];
}

export class ExcludedComparableDto {
  @IsString()
  @Matches(/\S/)
  id!: string;

  @IsString()
  @Matches(/\S/)
  reason!: string;
}
