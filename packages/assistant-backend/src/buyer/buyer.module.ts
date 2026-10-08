import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuyerUnmatchedDemandEntity } from '../database/buyer-unmatched-demand.entity';
import { LotsModule } from '../lots/lots.module';
import { LotsService } from '../lots/lots.service';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';
import { BuyerSearchService } from './buyer-search.service';
import { BuyerController } from './buyer.controller';
import { UnmatchedDemandDbStore } from './unmatched-demand.db-store';

@Module({
  imports: [TypeOrmModule.forFeature([BuyerUnmatchedDemandEntity]), LotsModule],
  controllers: [BuyerController],
  providers: [
    BuyerCriteriaService,
    UnmatchedDemandDbStore,
    {
      // Buyer search runs on the real lots search and records no-result demand in the database.
      provide: BuyerSearchOrchestrator,
      inject: [LotsService, UnmatchedDemandDbStore],
      useFactory: (lotsService: LotsService, demandStore: UnmatchedDemandDbStore) =>
        new BuyerSearchOrchestrator(lotsService, new BuyerSearchService(), demandStore),
    },
  ],
  exports: [BuyerCriteriaService, UnmatchedDemandDbStore, BuyerSearchOrchestrator],
})
export class BuyerModule {}
