import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiHistoryEntity } from '../database/ai-history.entity';
import { AiHistoryService } from './ai-history.service';
import { ProfilesModule } from '../profiles/profiles.module';
import { FixtureProviderService } from './fixture-provider.service';
import { RealProviderService } from './real-provider.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  controllers: [AiController],
  imports: [ProfilesModule, TypeOrmModule.forFeature([AiHistoryEntity])],
  providers: [AiService, FixtureProviderService, RealProviderService, AiHistoryService],
  exports: [AiService],
})
export class AiModule {}
