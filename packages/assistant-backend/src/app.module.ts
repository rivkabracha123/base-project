import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { environmentSchema } from './config/environment';
import { AuctionLotEntity } from './database/auction-lot.entity';
import { SellerEntity } from './database/seller.entity';
import { SellerItemEntity } from './database/seller-item.entity';
import { ItemEvidenceEntity } from './database/item-evidence.entity';
import { ItemFactEntity } from './database/item-fact.entity';
import { ItemRevisionEntity } from './database/item-revision.entity';
import { CreateAuctionLots1710000000000 } from './database/1710000000000-create-auction-lots';
import { CreateSellerIntakeTables1720000000000 } from './database/1720000000000-create-seller-intake-tables';
import { ComparablesModule } from './comparables/comparables.module';
import { HealthModule } from './health/health.module';
import { LotsModule } from './lots/lots.module';
import { SellerIntakeModule } from './seller-intake/seller-intake.module';
import { StorageModule } from './storage/storage.module';

/**
 * Root application module for the Monabid Assistant backend.
 *
 * This module orchestrates the entire application lifecycle:
 * - Environment configuration with Zod validation
 * - PostgreSQL database connection via TypeORM
 * - Business domain modules (health, lots, seller-intake, storage)
 */
@Module({
  imports: [
    // Environment configuration: reads and validates process.env against the schema
    ConfigModule.forRoot({ isGlobal: true, validationSchema: environmentSchema }),

    // Database connection: async initialization via ConfigService + TypeORM
    // Uses DATABASE_URL from environment; migrations are not auto-run (synchronize: false)
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [AuctionLotEntity, SellerEntity, SellerItemEntity, ItemEvidenceEntity, ItemFactEntity, ItemRevisionEntity],
        migrations: [CreateAuctionLots1710000000000, CreateSellerIntakeTables1720000000000],
        synchronize: false,
      }),
    }),
    ComparablesModule,

    // System health check endpoint
    HealthModule,

    // Auction lots read/query operations
    LotsModule,

    // Seller intake flow: conversation, item draft extraction, handoff
    SellerIntakeModule,

    // File storage service: local and provider-based backends
    StorageModule,
  ],
})
export class AppModule {}
