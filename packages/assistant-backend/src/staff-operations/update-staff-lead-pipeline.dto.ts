import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { staffPipelineStatuses, StaffPipelineStatus } from './staff-lead-pipeline';

export class UpdateStaffLeadPipelineDto {
  @IsOptional()
  @IsIn(staffPipelineStatuses)
  status?: StaffPipelineStatus;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  nextAction?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
