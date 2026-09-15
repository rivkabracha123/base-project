import { Controller, Get, Param } from '@nestjs/common';
import { StaffOperationsService } from './staff-operations.service';
import { StaffOperationListItem } from './staff-operation-list-item';
import { StaffBuyerLeadDetail } from './staff-buyer-lead-detail';

@Controller('staff-operations')
export class StaffOperationsController {
  constructor(private readonly staffOpsService: StaffOperationsService) {}

  @Get('leads')
  async getLeads(): Promise<StaffOperationListItem[]> {
    return this.staffOpsService.findAll();
  }

  @Get('leads/:leadId')
  async getBuyerLeadDetail(@Param('leadId') leadId: string): Promise<StaffBuyerLeadDetail> {
    return this.staffOpsService.getBuyerLeadDetail(leadId);
  }
}
