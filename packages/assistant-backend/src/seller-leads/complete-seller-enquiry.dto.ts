import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { SellerLeadContactDto } from './create-seller-lead.dto';
import { SubmitSellerLeadDto } from './submit-seller-lead.dto';

/** Internal enquiry: optionally targets a chosen house, but never contacts one externally. */
export class CompleteSellerEnquiryDto extends SubmitSellerLeadDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  houseId?: string;

  @IsOptional()
  @IsBoolean()
  generalEnquiry?: boolean;

  @ValidateNested()
  @Type(() => SellerLeadContactDto)
  contact: SellerLeadContactDto;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  profileId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  geography?: string;
}
