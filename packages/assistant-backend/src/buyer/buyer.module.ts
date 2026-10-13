import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuyerUnmatchedDemandEntity } from '../database/buyer-unmatched-demand.entity';
import { LotsModule } from '../lots/lots.module';
import { LotsService } from '../lots/lots.service';
import { AiModule } from '../ai/ai.module';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';
import { BuyerSearchService } from './buyer-search.service';
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

import { UnmatchedDemandDbStore } from './unmatched-demand.db-store';
import { SellerLeadsModule } from '../seller-leads/seller-leads.module';
import { ComparablesModule } from '../comparables/comparables.module';

@Module({
  imports: [AiModule, TypeOrmModule.forFeature([BuyerUnmatchedDemandEntity]), LotsModule, SellerLeadsModule, ComparablesModule],
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
    UnmatchedDemandDbStore,
    {
      // Buyer search runs on the real lots search and records no-result demand in the database.
      provide: BuyerSearchOrchestrator,
      inject: [LotsService, UnmatchedDemandDbStore],
      useFactory: (lotsService: LotsService, demandStore: UnmatchedDemandDbStore) =>
        new BuyerSearchOrchestrator(lotsService, new BuyerSearchService(), demandStore),
    },
  ],
  exports: [
    UnmatchedDemandDbStore,
    BuyerSearchOrchestrator,
    BuyerCriteriaService,
    BuyerSessionSearchService,
    BuyerP4BridgeService,
    BuyerChatOrchestratorService,
    BuyerSearchExecutionService,
    BUYER_RESULTS_PRESENTATION_PORT,
  ],
})
export class BuyerModule {}
