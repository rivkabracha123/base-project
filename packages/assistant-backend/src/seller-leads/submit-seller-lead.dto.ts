import { sellerLeadValuationSchema } from '@monabid/shared';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
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

export class DashboardSourceDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  url: string | null;
}

export class DashboardValuationComparableDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @ValidateNested()
  @Type(() => DashboardSourceDto)
  source: DashboardSourceDto;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  saleDate?: string;
}

export class DashboardExcludedComparableDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class DashboardValuationConfidenceDto {
  @IsIn(['low'])
  level: 'low';

  @IsString()
  @IsNotEmpty()
  explanation: string;
}

@ValidatorConstraint({ name: 'dashboardValuationDto' })
class IsDashboardValuationDto implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return sellerLeadValuationSchema.safeParse(value).success;
  }

  defaultMessage(): string {
    return 'valuation must match DashboardValuationDto';
  }
}

export class SellerLeadValuationDto {
  @IsIn(['supported', 'refusal'])
  status: 'supported' | 'refusal';

  @IsString()
  @IsNotEmpty()
  reportId: string;

  @IsInt()
  @Min(0)
  comparableCount: number;

  @ValidateNested()
  @Type(() => DashboardValuationConfidenceDto)
  confidence: DashboardValuationConfidenceDto;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  limitations: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardValuationComparableDto)
  comparables: DashboardValuationComparableDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardExcludedComparableDto)
  excludedComparables: DashboardExcludedComparableDto[];

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

  @Validate(IsDashboardValuationDto)
  @ValidateNested()
  @Type(() => SellerLeadValuationDto)
  valuation: SellerLeadValuationDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SellerLeadComparableRefDto)
  comparables?: SellerLeadComparableRefDto[];
}
