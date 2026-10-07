import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { ComparablesController } from './comparables.controller';
import { ComparablesService } from './comparables.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuctionLotEntity])],
  controllers: [ComparablesController],
  providers: [ComparablesService],
  exports: [ComparablesService],
})
export class ComparablesModule {}
