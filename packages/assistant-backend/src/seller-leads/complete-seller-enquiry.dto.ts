import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { SellerLeadContactDto } from './create-seller-lead.dto';
import { SubmitSellerLeadDto } from './submit-seller-lead.dto';

/** One internal enquiry: rank once, save choice, persist catalog + valuation. Never contacts a house. */
export class CompleteSellerEnquiryDto extends SubmitSellerLeadDto {
  @IsString()
  @IsNotEmpty()
  houseId: string;

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
