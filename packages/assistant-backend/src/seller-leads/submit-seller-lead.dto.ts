import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CatalogDraftDto {
  @IsString()
  @IsNotEmpty()
  he: string;

  @IsString()
  @IsNotEmpty()
  en: string;
}

export class SellerLeadItemDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsArray()
  @IsString({ each: true })
  evidenceIds: string[];
}

export class SellerLeadEvidenceDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;
}

export class SellerLeadComparableRefDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  source?: string;
}

export class SellerLeadValuationRangeDto {
  @IsNumber()
  min: number;

  @IsNumber()
  max: number;

  @IsIn(['USD'])
  currency: 'USD';
}

export class SellerLeadValuationDto {
  @IsIn(['supported', 'refusal'])
  status: 'supported' | 'refusal';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reportId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SellerLeadValuationRangeDto)
  valuationRange?: SellerLeadValuationRangeDto;
}

/** S5 Week 5: body for POST /api/seller-leads/:id/final. */
export class SubmitSellerLeadDto {
  @ValidateNested()
  @Type(() => CatalogDraftDto)
  catalogDraft: CatalogDraftDto;

  @ValidateNested()
  @Type(() => SellerLeadItemDto)
  item: SellerLeadItemDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SellerLeadEvidenceDto)
  evidence: SellerLeadEvidenceDto[];

  @ValidateNested()
  @Type(() => SellerLeadValuationDto)
  valuation: SellerLeadValuationDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SellerLeadComparableRefDto)
  comparables?: SellerLeadComparableRefDto[];
}
