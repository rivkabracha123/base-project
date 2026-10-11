import { Module } from '@nestjs/common';
import { BuyerChatController } from './buyer-chat.controller';
import { BuyerChatService } from './buyer-chat.service';

// Bundles the chat controller and service into one NestJS module.
@Module({
  controllers: [BuyerChatController],
  providers: [BuyerChatService],
})
export class BuyerChatModule {}
