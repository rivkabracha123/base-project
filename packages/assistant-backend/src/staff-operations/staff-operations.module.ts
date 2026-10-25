import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffOperationsController } from './staff-operations.controller';
import { StaffOperationsService } from './staff-operations.service';
import { StaffOperationEntity } from '../database/staff-operation.entity';
import { BuyerModule } from '../buyer/buyer.module';
import { BUYER_LEAD_DASHBOARD_SOURCE } from './buyer-lead-dashboard-source';
import { UnmatchedDemandBuyerLeadDashboardSource } from './unmatched-demand-buyer-lead-dashboard.source';

@Module({
  imports: [TypeOrmModule.forFeature([StaffOperationEntity]), BuyerModule],
  controllers: [StaffOperationsController],
  providers: [
    StaffOperationsService,
    UnmatchedDemandBuyerLeadDashboardSource,
    {
      provide: BUYER_LEAD_DASHBOARD_SOURCE,
      useExisting: UnmatchedDemandBuyerLeadDashboardSource,
    },
  ],
})
export class StaffOperationsModule {}
