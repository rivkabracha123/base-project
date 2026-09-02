import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsString, ValidateNested } from 'class-validator';

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

export class ValuationInputDto {
  @IsString()
  itemId!: string;

  @IsString()
  itemVersion!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComparableSaleDto)
  comparables!: ComparableSaleDto[];
}
