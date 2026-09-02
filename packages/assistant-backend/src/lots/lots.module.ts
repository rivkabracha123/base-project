import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { LotsController } from './lots.controller';
// My API for the task-avishag
import { Task1AvishagController } from './task1-avishag-tests/task1-avishag-controller';
import { LotsService } from './lots.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuctionLotEntity])],
  controllers: [Task1AvishagController, LotsController],
  providers: [LotsService],
})
export class LotsModule {}
