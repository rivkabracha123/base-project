import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { environmentSchema } from './config/environment';
import { AuctionLotEntity } from './database/auction-lot.entity';
import { CreateAuctionLots1710000000000 } from './database/1710000000000-create-auction-lots';
import { AiModule } from './ai/ai.module';
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
        entities: [AuctionLotEntity],
        migrations: [CreateAuctionLots1710000000000],
        synchronize: false,
      }),
    }),
    AiModule,
    HealthModule,
    LotsModule,
    StorageModule,
  ],
})
export class AppModule {}
