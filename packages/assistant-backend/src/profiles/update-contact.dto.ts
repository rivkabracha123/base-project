import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
//update contact
export class UpdateContactDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ()-]{7,20}$/)
  phone?: string;

  @IsBoolean()
  consentGranted!: boolean;
}