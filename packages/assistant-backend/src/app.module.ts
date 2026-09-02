import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { environmentSchema } from './config/environment';
import { AuctionLotEntity } from './database/auction-lot.entity';
import { CreateAuctionLots1710000000000 } from './database/1710000000000-create-auction-lots';
import { HealthModule } from './health/health.module';
import { LotsModule } from './lots/lots.module';
import { StorageModule } from './storage/storage.module';

import { StaffOperationEntity } from './database/staff-operation.entity';
import { StaffOperationsModule } from './staff-operations/staff-operations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: environmentSchema }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [AuctionLotEntity, StaffOperationEntity],
        migrations: [CreateAuctionLots1710000000000],
        synchronize: false,
      }),
    }),
    HealthModule,
    LotsModule,
    StorageModule,
    StaffOperationsModule,
  ],
})
export class AppModule {}
