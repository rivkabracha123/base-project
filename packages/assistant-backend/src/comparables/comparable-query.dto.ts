import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class ComparableQueryDto {
  @IsString()
  @MinLength(1)
  category: string;

  // Week 3 — confirmed materials (from S1's confirmedFacts), optional so the Week 2
  // { category } shape keeps working unchanged.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  materials?: string[];
}
