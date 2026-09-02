import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { LotsController } from './lots.controller';
// My API for the task-avishag
import { LotsService } from './lots.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuctionLotEntity])],
  providers: [LotsService],
})
export class LotsModule {}
