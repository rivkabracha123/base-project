import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiHistoryEntity } from '../database/ai-history.entity';
import { ProfilesModule } from '../profiles/profiles.module';
import { AiController } from './ai.controller';
import { AiHistoryService } from './ai-history.service';
import { AiService } from './ai.service';
import { FixtureProviderService } from './fixture-provider.service';
import { P4AiGenerateClient } from './p4-ai-generate.client';
import { RealProviderService } from './real-provider.service';

@Module({
  controllers: [AiController],
  imports: [ProfilesModule, TypeOrmModule.forFeature([AiHistoryEntity])],
  providers: [
    AiService,
    FixtureProviderService,
    RealProviderService,
    AiHistoryService,
    P4AiGenerateClient,
  ],
  exports: [AiService, P4AiGenerateClient],
})
export class AiModule {}
