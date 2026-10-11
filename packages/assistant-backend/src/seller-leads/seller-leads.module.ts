import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComparablesModule } from '../comparables/comparables.module';
import { SellerLeadEntity } from '../database/seller-lead.entity';
import { ProfilesModule } from '../profiles/profiles.module';
import { ItemValuationService } from '../valuation-calculation/item-valuation.service';
import { ValuationCalculationModule } from '../valuation-calculation/valuation-calculation.module';
import { SellerLeadsController } from './seller-leads.controller';
import { SellerLeadsService } from './seller-leads.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SellerLeadEntity]),
    ProfilesModule,
    ComparablesModule,
    ValuationCalculationModule,
  ],
  controllers: [SellerLeadsController],
  providers: [SellerLeadsService, ItemValuationService],
  exports: [SellerLeadsService],
})
export class SellerLeadsModule {}
