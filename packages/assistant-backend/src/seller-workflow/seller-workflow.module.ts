import { Module } from '@nestjs/common';
import { ComparablesModule } from '../comparables/comparables.module';
import { ValuationCalculationModule } from '../valuation-calculation/valuation-calculation.module';
import { ItemValuationService } from '../valuation-calculation/item-valuation.service';
import { SellerIntakeModule } from '../seller-intake/seller-intake.module';
import { SellerLeadsModule } from '../seller-leads/seller-leads.module';
import { UploadsModule } from '../uploads/uploads.module';
import { SellerWorkflowController } from './seller-workflow.controller';
import { SellerWorkflowService } from './seller-workflow.service';

@Module({
  imports: [SellerIntakeModule, SellerLeadsModule, UploadsModule, ComparablesModule, ValuationCalculationModule],
  controllers: [SellerWorkflowController],
  providers: [SellerWorkflowService, ItemValuationService],
  exports: [SellerWorkflowService],
})
export class SellerWorkflowModule {}
