import { Module } from '@nestjs/common';
import { SellerIntakeModule } from '../seller-intake/seller-intake.module';
import { SellerLeadsModule } from '../seller-leads/seller-leads.module';
import { UploadsModule } from '../uploads/uploads.module';
import { SellerWorkflowController } from './seller-workflow.controller';
import { SellerWorkflowService } from './seller-workflow.service';

@Module({
  imports: [SellerIntakeModule, SellerLeadsModule, UploadsModule],
  controllers: [SellerWorkflowController],
  providers: [SellerWorkflowService],
  exports: [SellerWorkflowService],
})
export class SellerWorkflowModule {}