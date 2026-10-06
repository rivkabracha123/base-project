import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class UpdateConsentDto {
  @IsBoolean()
  granted!: boolean;

  @IsOptional()
  @IsDateString()
  grantedAt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  channel?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  policyVersion?: string;
}

export class UpdateCurrentProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  preferredName?: string;

  @IsOptional()
  @IsIn(['masculine', 'feminine', 'neutral', 'unspecified'])
  grammaticalForm?: 'masculine' | 'feminine' | 'neutral' | 'unspecified';

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateConsentDto)
  serviceConsent?: UpdateConsentDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateConsentDto)
  marketingConsent?: UpdateConsentDto;
}
