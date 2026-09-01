import { Controller, Get } from '@nestjs/common';
import { StaffOperationsService } from './staff-operations.service';
import { StaffOperationListItem } from './staff-operation-list-item';

@Controller('staff-operations')
export class StaffOperationsController {
  constructor(private readonly staffOpsService: StaffOperationsService) {}

  // Endpoint המספק את נתוני הלידים ללקוח (Frontend)
  @Get('leads')
  async getLeads(): Promise<StaffOperationListItem[]> {
    return this.staffOpsService.findAll();
  }
}
