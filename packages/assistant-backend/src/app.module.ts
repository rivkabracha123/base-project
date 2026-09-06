import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { environmentSchema } from './config/environment';
import { AuctionLotEntity } from './database/auction-lot.entity';
import { UserProfileEntity } from './database/user-profile.entity';
import { StaffOperationEntity } from './database/staff-operation.entity';
import { CreateAuctionLots1710000000000 } from './database/1710000000000-create-auction-lots';
import { CreateUserProfiles1730000000000 } from './database/1730000000000-create-user-profiles';
import { CreateStaffOperations1725000000000 } from './database/1725000000000-create-staff-operations';
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
        entities: [AuctionLotEntity, UserProfileEntity, StaffOperationEntity],
        migrations: [
          CreateAuctionLots1710000000000,
          CreateUserProfiles1730000000000,
          CreateStaffOperations1725000000000,
        ],
        synchronize: false,
      }),
    }),
    AiModule,
    HealthModule,
    LotsModule,
    ProfilesModule,
    StorageModule,
    StaffOperationsModule,
  ],
})
export class AppModule {}
