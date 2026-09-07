import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { environmentSchema } from './config/environment';
import { AuctionLotEntity } from './database/auction-lot.entity';
import { CreateAuctionLots1710000000000 } from './database/1710000000000-create-auction-lots';
import { ComparablesModule } from './comparables/comparables.module';
import { HealthModule } from './health/health.module';
import { LotsModule } from './lots/lots.module';
import { SellerIntakeModule } from './seller-intake/seller-intake.module';
import { StorageModule } from './storage/storage.module';
import { AlomaShilatModule } from './aluma-shilat/aluma-shilat.module';

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
        entities: [AuctionLotEntity],
        migrations: [CreateAuctionLots1710000000000],
        synchronize: false,
      }),
    }),

    // System health check endpoint
    ComparablesModule,
    HealthModule,

    // Auction lots read/query operations
    LotsModule,

    // Seller intake flow: conversation, item draft extraction, handoff
    SellerIntakeModule,

    // File storage service: local and provider-based backends
    StorageModule,
    AlomaShilatModule,
  ],
})
export class AppModule {}
