import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { environmentSchema } from './config/environment';

import { AuctionLotEntity } from './database/auction-lot.entity';
import { SellerEntity } from './database/seller.entity';
import { SellerItemEntity } from './database/seller-item.entity';
import { ItemEvidenceEntity } from './database/item-evidence.entity';
import { ItemFactEntity } from './database/item-fact.entity';
import { ItemRevisionEntity } from './database/item-revision.entity';
import { SellerLeadEntity } from './database/seller-lead.entity';

import { CreateAuctionLots1710000000000 } from './database/1710000000000-create-auction-lots';
import { CreateMonabidBasicSchema1710000000001 } from './database/1710000000001-create-monabid-basic-schema';
import { CreateSellerIntakeTables1720000000000 } from './database/1720000000000-create-seller-intake-tables';
import { CreateSellerLeads1788220800000 } from './database/1788220800000-create-seller-leads';

import { AlomaShilatModule } from './aluma-shilat/aluma-shilat.module';
import { ComparablesModule } from './comparables/comparables.module';
import { HealthModule } from './health/health.module';
import { LotsModule } from './lots/lots.module';
import { SellerIntakeModule } from './seller-intake/seller-intake.module';
import { SellerLeadsModule } from './seller-leads/seller-leads.module';
import { StorageModule } from './storage/storage.module';

export function databaseOptions(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: config.getOrThrow<string>('DATABASE_URL'),
    entities: [
      AuctionLotEntity,
      SellerEntity,
      SellerItemEntity,
      ItemEvidenceEntity,
      ItemFactEntity,
      ItemRevisionEntity,
      SellerLeadEntity,
    ],
    migrations: [
      CreateAuctionLots1710000000000,
      CreateMonabidBasicSchema1710000000001,
      CreateSellerIntakeTables1720000000000,
      CreateSellerLeads1788220800000,
    ],
    synchronize: false,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: environmentSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: databaseOptions,
    }),
    ComparablesModule,
    HealthModule,
    LotsModule,
    SellerIntakeModule,
    SellerLeadsModule,
    StorageModule,
    AlomaShilatModule,
  ],
})
export class AppModule {}