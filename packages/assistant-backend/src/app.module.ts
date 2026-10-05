import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { environmentSchema } from './config/environment';
import { AuctionLotEntity } from './database/auction-lot.entity';
import { CreateAuctionLots1710000000000 } from './database/1710000000000-create-auction-lots';
import { CreateMonabidBasicSchema1710000000001 } from './database/1710000000001-create-monabid-basic-schema';
import { UserProfileEntity } from './database/user-profile.entity';
import { CreateUserProfiles1730000000000 } from './database/1730000000000-create-user-profiles';
import { SellerLeadEntity } from './database/seller-lead.entity';
import { CreateSellerLeads1788220800000 } from './database/1788220800000-create-seller-leads';
import { ValuationCalculationModule } from './valuation-calculation/valuation-calculation.module';
import { AddSellerLeadRecommendation1788220800001 } from './database/1788220800001-add-seller-lead-recommendation';
import { AddSellerLeadChoice1788220800002 } from './database/1788220800002-add-seller-lead-choice';
import { AddSellerLeadFinal1788220800003 } from './database/1788220800003-add-seller-lead-final';
import { AddSellerLeadDashboard1788220800004 } from './database/1788220800004-add-seller-lead-dashboard';
import { ComparablesModule } from './comparables/comparables.module';
import { HealthModule } from './health/health.module';
import { LotsModule } from './lots/lots.module';
import { ProfilesModule } from './profiles/profiles.module';
import { SellerIntakeModule } from './seller-intake/seller-intake.module';
import { SellerLeadsModule } from './seller-leads/seller-leads.module';
import { StorageModule } from './storage/storage.module';
import { UploadsModule } from './uploads/uploads.module';

/**
 * Root application module for the Monabid Assistant backend.
 *
 * This module orchestrates the entire application lifecycle:
 * - Environment configuration with Zod validation
 * - PostgreSQL database connection via TypeORM
 * - Business domain modules (health, lots, seller-intake, seller-leads, storage)
 */
export function databaseOptions(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: config.getOrThrow<string>('DATABASE_URL'),
    entities: [AuctionLotEntity, UserProfileEntity, SellerLeadEntity],
    migrations: [
      CreateAuctionLots1710000000000,
      CreateMonabidBasicSchema1710000000001,
      CreateUserProfiles1730000000000,
      CreateSellerLeads1788220800000,
      AddSellerLeadRecommendation1788220800001,
      AddSellerLeadChoice1788220800002,
      AddSellerLeadFinal1788220800003,
      AddSellerLeadDashboard1788220800004,
    ],
    synchronize: false,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: environmentSchema }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: databaseOptions,
    }),
    ComparablesModule,
    HealthModule,
    LotsModule,
    ProfilesModule,
    SellerIntakeModule,
    SellerLeadsModule,
    StorageModule,
    ValuationCalculationModule,
    UploadsModule,
  ],
})
export class AppModule {}
