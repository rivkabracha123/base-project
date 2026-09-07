import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { LotsController } from './lots.controller';
import { LotsService } from './lots.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuctionLotEntity])],
  controllers: [LotsController],
  providers: [LotsService],
  exports: [LotsService],
})
export class LotsModule {}
