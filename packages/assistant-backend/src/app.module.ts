import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { environmentSchema } from './config/environment';
import { AuctionLotEntity } from './database/auction-lot.entity';
import { UserProfileEntity } from './database/user-profile.entity';
import { StaffOperationEntity } from './database/staff-operation.entity';
import { CreateAuctionLots1710000000000 } from './database/1710000000000-create-auction-lots';
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
import { CreateUserProfiles1730000000000 } from './database/1730000000000-create-user-profiles';
import { CreateStaffOperations1725000000000 } from './database/1725000000000-create-staff-operations';
import { BuyerUnmatchedDemandEntity } from './database/buyer-unmatched-demand.entity';
import { CreateBuyerUnmatchedDemand1740000000000 } from './database/1740000000000-create-buyer-unmatched-demand';
import { AiModule } from './ai/ai.module';
import { HealthModule } from './health/health.module';
import { LotsModule } from './lots/lots.module';
import { ProfilesModule } from './profiles/profiles.module';
import { StorageModule } from './storage/storage.module';

import { StaffOperationsModule } from './staff-operations/staff-operations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: environmentSchema }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [
          AuctionLotEntity,
          AnonymousProfileEntity,
          AiProviderConfigEntity,
          SellerLeadEntity,
          BuyerRequestEntity,
          BuyerCriteriaEntity,
          BuyerConversationEntity,
          UserProfileEntity,
          StaffOperationEntity,
          BuyerUnmatchedDemandEntity,
        ],
        migrations: [
          CreateAuctionLots1710000000000,
          CreateTeamTables1710000000001,
          CreateBuyerTables1710000000002,
          CreateUserProfiles1730000000000,
          CreateStaffOperations1725000000000,
          CreateBuyerUnmatchedDemand1740000000000,
        ],
        synchronize: false,
      }),
    }),
    BuyerModule,
    AiModule,
    HealthModule,
    LotsModule,
    ChatModule,
    ProfilesModule,
    StorageModule,
    StaffOperationsModule,
  ],
})
export class AppModule {}
