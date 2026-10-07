import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PreparedAuctionHouseDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsBoolean()
  active: boolean;

  @IsArray()
  @IsString({ each: true })
  categories: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  geography?: string;

  @IsArray()
  @IsString({ each: true })
  languages: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  recentSaleDate?: string;

  @IsObject()
  comparableSoldCountByCategory: Record<string, number>;
}

export class RankHousesDto {
  @IsString()
  @IsNotEmpty()
  category: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  geography?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  preferredLanguage?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreparedAuctionHouseDto)
  houses?: PreparedAuctionHouseDto[];
}
