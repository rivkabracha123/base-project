import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

export class SellerLeadContactDto {
  @IsString()
  @IsNotEmpty()
  preferredName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;
}

@ValidatorConstraint({ name: 'emailOrPhoneProvided' })
class EmailOrPhoneProvided implements ValidatorConstraintInterface {
  validate(contact?: SellerLeadContactDto): boolean {
    return Boolean(contact?.email ?? contact?.phone);
  }

  defaultMessage(): string {
    return 'contact requires either an email or a phone number';
  }
}

export class CreateSellerLeadDto {
  @IsString()
  @IsNotEmpty()
  profileId: string;

  @ValidateNested()
  @Type(() => SellerLeadContactDto)
  @Validate(EmailOrPhoneProvided)
  contact: SellerLeadContactDto;

  @IsBoolean()
  @Equals(true)
  serviceConsent: boolean;
}
