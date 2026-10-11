import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { StaffOperationsService } from './staff-operations.service';
import { StaffOperationListItem } from './staff-operation-list-item';
import { StaffBuyerLeadDetail } from './staff-buyer-lead-detail';
import { StaffSellerLeadDetail } from './staff-seller-lead-detail';
import { StaffLeadPipeline, UpdateStaffLeadPipelineInput } from './staff-lead-pipeline';
import { UpdateStaffLeadPipelineDto } from './update-staff-lead-pipeline.dto';

@Controller('staff-operations')
export class StaffOperationsController {
  constructor(private readonly staffOpsService: StaffOperationsService) {}

  @Get('leads')
  async getLeads(): Promise<StaffOperationListItem[]> {
    return this.staffOpsService.findAll();
  }

  @Get('leads/:leadId')
  async getLeadDetail(@Param('leadId') leadId: string): Promise<StaffBuyerLeadDetail | StaffSellerLeadDetail> {
    return this.staffOpsService.getLeadDetail(leadId);
  }

  @Get('leads/:leadId/pipeline')
  async getPipeline(@Param('leadId') leadId: string): Promise<StaffLeadPipeline> {
    return this.staffOpsService.getPipeline(leadId);
  }

  @Patch('leads/:leadId/pipeline')
  async updatePipeline(
    @Param('leadId') leadId: string,
    @Body() update: UpdateStaffLeadPipelineDto,
  ): Promise<StaffLeadPipeline> {
    return this.staffOpsService.updatePipeline(leadId, update as UpdateStaffLeadPipelineInput);
  }

  async getBuyerLeadDetail(leadId: string): Promise<StaffBuyerLeadDetail> {
    return this.staffOpsService.getBuyerLeadDetail(leadId);
  }
}
