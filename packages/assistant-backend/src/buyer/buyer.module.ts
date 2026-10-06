import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerController } from './buyer.controller';
import { BuyerP4BridgeService } from './buyer-p4-bridge.service';
import { BuyerSessionSearchService } from './buyer-session-search.service';

@Module({
  imports: [AiModule],
  controllers: [BuyerController],
  providers: [BuyerCriteriaService, BuyerSessionSearchService, BuyerP4BridgeService],
  exports: [BuyerCriteriaService, BuyerSessionSearchService, BuyerP4BridgeService],
})
export class BuyerModule {}
