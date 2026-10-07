import { Module } from '@nestjs/common';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerController } from './buyer.controller';

@Module({
  controllers: [BuyerController],
  providers: [BuyerCriteriaService],
  exports: [BuyerCriteriaService],
})
export class BuyerModule {}
