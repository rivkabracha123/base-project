import { Module } from '@nestjs/common';
import { SellerChatController } from './seller-chat.controller';
import { SellerChatService } from './seller-chat.service';

// Bundles the seller chat controller and service into one NestJS module.
@Module({
  controllers: [SellerChatController],
  providers: [SellerChatService],
})
export class SellerChatModule {}
