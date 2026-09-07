import { IsString, MinLength } from 'class-validator';

export class ComparableQueryDto {
  @IsString()
  @MinLength(1)
  category: string;
}
