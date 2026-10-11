import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { LotsModule } from '../lots/lots.module';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerController } from './buyer.controller';
import { BuyerP4BridgeService } from './buyer-p4-bridge.service';
import { BuyerSessionSearchService } from './buyer-session-search.service';
import { BuyerChatOrchestratorService } from './buyer-chat-orchestrator.service';
import { BuyerComparableSaleHistoryService } from './buyer-comparable-sale-history.service';
import { BuyerP4FunctionExecutor } from './buyer-p4-function.executor';
import { BuyerLotsResolverService } from './buyer-lots-resolver.service';
import { LotsServiceSearchClient } from './lots-service-search.client';
import { BUYER_RESULTS_PRESENTATION_PORT } from './buyer-results-presentation.port';
import { BatyaBuyerResultsPresentationService } from './batya-buyer-results-presentation.service';
import { BuyerSearchExecutionService } from './buyer-search-execution.service';

@Module({
  imports: [AiModule, LotsModule],
  controllers: [BuyerController],
  providers: [
    BuyerCriteriaService,
    BuyerSearchExecutionService,
    {
      provide: BUYER_RESULTS_PRESENTATION_PORT,
      useClass: BatyaBuyerResultsPresentationService,
    },
    BuyerSessionSearchService,
    BuyerP4BridgeService,
    BuyerComparableSaleHistoryService,
    BuyerP4FunctionExecutor,
    BuyerChatOrchestratorService,
    LotsServiceSearchClient,
    BuyerLotsResolverService,
  ],
  exports: [
    BuyerCriteriaService,
    BuyerSessionSearchService,
    BuyerP4BridgeService,
    BuyerChatOrchestratorService,
    BuyerSearchExecutionService,
    BUYER_RESULTS_PRESENTATION_PORT,
  ],
})
export class BuyerModule {}
