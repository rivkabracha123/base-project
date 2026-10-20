import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  Min,
} from 'class-validator';

/**
 * Validates and documents the chat snapshot accepted by the save endpoint.
 * מגדיר ומתעד את מבנה תמונת השיחה שה-endpoint לשמירה מקבל ומאמת.
 */
export class SaveChatSnapshotDto {
  @IsIn(['buyer', 'seller'])
  role!: 'buyer' | 'seller';

  @IsIn(['he', 'en'])
  language!: 'he' | 'en';

  @IsArray()
  @ArrayMinSize(1)
  @IsObject({ each: true })
  messages!: Record<string, unknown>[];

  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
