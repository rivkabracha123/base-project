import { Module } from '@nestjs/common';
import { FixtureProviderService } from './fixture-provider.service';
import { RealProviderService } from './real-provider.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  controllers: [AiController],
  providers: [AiService, FixtureProviderService, RealProviderService],
  exports: [AiService],
})
export class AiModule {}
