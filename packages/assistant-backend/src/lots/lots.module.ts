import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { LotsController } from './lots.controller';
import { LotsImportReportService } from './lots-import-report.service';
import { LotsService } from './lots.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuctionLotEntity])],
  controllers: [LotsController],
  providers: [LotsService, LotsImportReportService],
})
export class LotsModule {}
