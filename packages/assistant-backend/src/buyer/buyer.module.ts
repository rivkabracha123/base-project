import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { BuyerUnmatchedDemandEntity } from '../database/buyer-unmatched-demand.entity';
import { LotsModule } from '../lots/lots.module';
import { SellerLeadsModule } from '../seller-leads/seller-leads.module';
import { ComparablesModule } from '../comparables/comparables.module';
import { BuyerHouseRecommendationService } from './buyer-house-recommendation.service';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';
import { BuyerSearchService } from './buyer-search.service';
import { BuyerController } from './buyer.controller';
import { UnmatchedDemandDbStore } from './unmatched-demand.db-store';
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
  imports: [TypeOrmModule.forFeature([BuyerUnmatchedDemandEntity]), AiModule, LotsModule, SellerLeadsModule, ComparablesModule],
  controllers: [BuyerController],
  providers: [
    BuyerCriteriaService,
    UnmatchedDemandDbStore,
    {
      // Buyer search runs on the real lots search, validated against its own request rules, and records no-result demand in the database.
      provide: BuyerSearchOrchestrator,
      inject: [LotsServiceSearchClient, UnmatchedDemandDbStore],
      useFactory: (lotsSearch: LotsServiceSearchClient, demandStore: UnmatchedDemandDbStore) =>
        new BuyerSearchOrchestrator(lotsSearch, new BuyerSearchService(), demandStore),
    },
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
    BuyerHouseRecommendationService,
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
