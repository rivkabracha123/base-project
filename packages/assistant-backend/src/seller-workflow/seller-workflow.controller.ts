import { Body, Controller, Post } from '@nestjs/common';
import { SellerWorkflowRequestDto } from './seller-workflow.dto';
import { SellerWorkflowService } from './seller-workflow.service';
import type { SellerWorkflowResult } from './seller-workflow.types';

@Controller('seller-workflow')
export class SellerWorkflowController {
  constructor(private readonly workflow: SellerWorkflowService) {}

  @Post('callback')
  execute(
    @Body() request: SellerWorkflowRequestDto,
  ): Promise<SellerWorkflowResult> {
    return this.workflow.execute(request);
  }
}