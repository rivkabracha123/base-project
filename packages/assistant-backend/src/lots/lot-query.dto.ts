import { IsIn, IsOptional } from 'class-validator';

export class LotQueryDto {
  @IsOptional()
  @IsIn(['en', 'he'])
  language?: 'en' | 'he';
}
