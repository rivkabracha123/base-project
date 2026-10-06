import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { environmentSchema } from './config/environment';
import { AuctionLotEntity } from './database/auction-lot.entity';
import { UserProfileEntity } from './database/user-profile.entity';
import { StaffOperationEntity } from './database/staff-operation.entity';
import { CreateAuctionLots1710000000000 } from './database/1710000000000-create-auction-lots';
import { CreateStaffOperations1725000000000 } from './database/1725000000000-create-staff-operations';
import { CreateUserProfiles1730000000000 } from './database/1730000000000-create-user-profiles';
import { ChatModule } from './chat/chat.module';
import { CreateTeamTables1710000000001 } from './database/1710000000001-create-team-tables';
import { CreateBuyerTables1710000000002 } from './database/1710000000002-create-buyer-tables';
import { AiProviderConfigEntity } from './database/ai-provider-config.entity';
import { AnonymousProfileEntity } from './database/anonymous-profile.entity';
import { BuyerConversationEntity } from './database/buyer-conversation.entity';
import { BuyerCriteriaEntity } from './database/buyer-criteria.entity';
import { BuyerRequestEntity } from './database/buyer-request.entity';
import { SellerLeadEntity } from './database/seller-lead.entity';
import { BuyerModule } from './buyer/buyer.module';
import { AiModule } from './ai/ai.module';
import { HealthModule } from './health/health.module';
import { LotsModule } from './lots/lots.module';
import { ProfilesModule } from './profiles/profiles.module';
import { StorageModule } from './storage/storage.module';

import { StaffOperationsModule } from './staff-operations/staff-operations.module';
import { CreateMonabidBasicSchema1710000000001 } from './database/1710000000001-create-monabid-basic-schema';
import { SellerIntakeDraftEntity } from './database/seller-intake-draft.entity';
import { CreateSellerLeads1788220800000 } from './database/1788220800000-create-seller-leads';
import { ValuationCalculationModule } from './valuation-calculation/valuation-calculation.module';
import { AddSellerLeadRecommendation1788220800001 } from './database/1788220800001-add-seller-lead-recommendation';
import { AddSellerLeadChoice1788220800002 } from './database/1788220800002-add-seller-lead-choice';
import { CreateSellerIntakeDrafts1788220800003 } from './database/1788220800003-create-seller-intake-drafts';
import { ComparablesModule } from './comparables/comparables.module';
import { SellerIntakeModule } from './seller-intake/seller-intake.module';
import { SellerLeadsModule } from './seller-leads/seller-leads.module';
import { UploadsModule } from './uploads/uploads.module';
import { SellerWorkflowModule } from './seller-workflow/seller-workflow.module';

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
    entities: [
      AuctionLotEntity,
      UserProfileEntity,
      StaffOperationEntity,
      SellerLeadEntity,
      AnonymousProfileEntity,
      AiProviderConfigEntity,
      BuyerRequestEntity,
      BuyerCriteriaEntity,
      BuyerConversationEntity,
      SellerIntakeDraftEntity,
    ],
    migrations: [
      CreateAuctionLots1710000000000,
      CreateMonabidBasicSchema1710000000001,
      CreateTeamTables1710000000001,
      CreateBuyerTables1710000000002,
      CreateStaffOperations1725000000000,
      CreateUserProfiles1730000000000,
      CreateSellerLeads1788220800000,
      AddSellerLeadRecommendation1788220800001,
      AddSellerLeadChoice1788220800002,
      CreateSellerIntakeDrafts1788220800003,
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
    AiModule,
    BuyerModule,
    ChatModule,
    HealthModule,
    LotsModule,
    ProfilesModule,
    StorageModule,
    StaffOperationsModule,
    ComparablesModule,
    SellerIntakeModule,
    SellerLeadsModule,
    ValuationCalculationModule,
    UploadsModule,
    SellerWorkflowModule,
  ],
})
export class AppModule {}
