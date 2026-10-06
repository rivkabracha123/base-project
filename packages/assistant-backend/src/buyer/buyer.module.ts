import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerController } from './buyer.controller';
import { BuyerP4BridgeService } from './buyer-p4-bridge.service';
import { BuyerSessionSearchService } from './buyer-session-search.service';
import { BuyerChatOrchestratorService } from './buyer-chat-orchestrator.service';
import { BuyerComparableSaleHistoryService } from './buyer-comparable-sale-history.service';
import { BuyerP4FunctionExecutor } from './buyer-p4-function.executor';

@Module({
  imports: [AiModule],
  controllers: [BuyerController],
  providers: [
    BuyerCriteriaService,
    BuyerSessionSearchService,
    BuyerP4BridgeService,
    BuyerComparableSaleHistoryService,
    BuyerP4FunctionExecutor,
    BuyerChatOrchestratorService,
  ],
  exports: [
    BuyerCriteriaService,
    BuyerSessionSearchService,
    BuyerP4BridgeService,
    BuyerChatOrchestratorService,
  ],
})
export class BuyerModule {}
