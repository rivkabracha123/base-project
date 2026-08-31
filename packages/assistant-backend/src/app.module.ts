import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { environmentSchema } from './config/environment';
import { AuctionLotEntity } from './database/auction-lot.entity';
import { CreateAuctionLots1710000000000 } from './database/1710000000000-create-auction-lots';
import { SellerLeadEntity } from './database/seller-lead.entity';
import { CreateSellerLeads1788220800000 } from './database/1788220800000-create-seller-leads';
import { HealthModule } from './health/health.module';
import { LotsModule } from './lots/lots.module';
import { SellerLeadsModule } from './seller-leads/seller-leads.module';
import { StorageModule } from './storage/storage.module';

export function databaseOptions(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: config.getOrThrow<string>('DATABASE_URL'),
    entities: [AuctionLotEntity, SellerLeadEntity],
    migrations: [CreateAuctionLots1710000000000, CreateSellerLeads1788220800000],
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
    HealthModule,
    LotsModule,
    SellerLeadsModule,
    StorageModule,
  ],
})
export class AppModule {}
