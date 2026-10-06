import { Module } from '@nestjs/common';
import { P4AiGenerateClient } from './p4-ai-generate.client';

@Module({
  providers: [P4AiGenerateClient],
  exports: [P4AiGenerateClient],
})
export class AiModule {}
