// Defines the rules the global ValidationPipe (main.ts) uses to parse and check incoming requests; it does not run them itself.
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsString, ValidateNested } from 'class-validator';

// Shape of one comparable sale inside the request body; every field is checked before it reaches the service.
export class ComparableSaleDto {
  @IsString()
  id!: string;

  @IsString()
  saleDate!: string;

  @IsNumber()
  soldPrice!: number;

  @IsString()
  currency!: string;

  @IsString()
  category!: string;

  @IsIn(['sold', 'unsold', 'upcoming'])
  status!: 'sold' | 'unsold' | 'upcoming';

  @IsString()
  source!: string;
}

// Shape of the full POST /aluma-shilat/valuation request body.
export class ValuationInputDto {
  @IsString()
  itemId!: string;

  @IsString()
  itemVersion!: string;

  // @Type + @ValidateNested convert and validate each array item as a ComparableSaleDto, not just the array itself.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComparableSaleDto)
  comparables!: ComparableSaleDto[];
}
