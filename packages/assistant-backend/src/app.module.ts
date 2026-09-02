import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { environmentSchema } from './config/environment';
import { AuctionLotEntity } from './database/auction-lot.entity';
import { CreateAuctionLots1710000000000 } from './database/1710000000000-create-auction-lots';
import { CreateTeamTables1710000000001 } from './database/1710000000001-create-team-tables';
import { CreateBuyerTables1710000000002 } from './database/1710000000002-create-buyer-tables';
import { AiProviderConfigEntity } from './database/ai-provider-config.entity';
import { AnonymousProfileEntity } from './database/anonymous-profile.entity';
import { BuyerConversationEntity } from './database/buyer-conversation.entity';
import { BuyerCriteriaEntity } from './database/buyer-criteria.entity';
import { BuyerRequestEntity } from './database/buyer-request.entity';
import { SellerLeadEntity } from './database/seller-lead.entity';
import { BuyerModule } from './buyer/buyer.module';
import { HealthModule } from './health/health.module';
import { LotsModule } from './lots/lots.module';
import { StorageModule } from './storage/storage.module';

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
        ],
        migrations: [
          CreateAuctionLots1710000000000,
          CreateTeamTables1710000000001,
          CreateBuyerTables1710000000002,
        ],
        synchronize: false,
      }),
    }),
    BuyerModule,
    HealthModule,
    LotsModule,
    StorageModule,
  ],
})
export class AppModule {}
