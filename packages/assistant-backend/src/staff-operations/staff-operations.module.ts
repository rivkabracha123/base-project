import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffOperationsController } from './staff-operations.controller';
import { StaffOperationsService } from './staff-operations.service';
import { StaffOperationEntity } from '../database/staff-operation.entity';
import { BUYER_LEAD_DASHBOARD_SOURCE } from './buyer-lead-dashboard-source';
import { FixtureBuyerLeadDashboardSource } from './fixture-buyer-lead-dashboard.source';

@Module({
  imports: [TypeOrmModule.forFeature([StaffOperationEntity])],
  controllers: [StaffOperationsController],
  providers: [
    StaffOperationsService,
    FixtureBuyerLeadDashboardSource,
    {
      provide: BUYER_LEAD_DASHBOARD_SOURCE,
      useExisting: FixtureBuyerLeadDashboardSource,
    },
  ],
})
export class StaffOperationsModule {}
