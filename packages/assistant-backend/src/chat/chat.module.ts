import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

// Bundles the chat controller and service into one NestJS module.
@Module({
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
