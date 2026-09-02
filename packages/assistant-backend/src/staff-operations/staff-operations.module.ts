import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffOperationsController } from './staff-operations.controller';
import { StaffOperationsService } from './staff-operations.service';
import { StaffOperationEntity } from '../database/staff-operation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StaffOperationEntity])],
  controllers: [StaffOperationsController],
  providers: [StaffOperationsService],
})
export class StaffOperationsModule {}