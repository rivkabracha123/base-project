import { Controller, Get, Query } from '@nestjs/common';
import { SellerChatService } from './seller-chat.service';

// Handles HTTP requests for the seller chat conversation and delegates them to the service.
// Mirrors buyer-chat/buyer-chat.controller.ts for the buyer chat.
@Controller('seller-chat')
export class SellerChatController {
  constructor(private readonly sellerChatService: SellerChatService) {}

  // GET /api/seller-chat/conversation?language=he — returns the conversation messages for the requested language.
  @Get('conversation')
  conversation(@Query('language') language: string): Promise<unknown[]> {
    return this.sellerChatService.findConversation(language);
  }
}
