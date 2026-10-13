import { Controller, Get, Query } from '@nestjs/common';
import { BuyerChatService } from './buyer-chat.service';

// Handles HTTP requests for the chat conversation and delegates them to the service.
@Controller('buyer-chat')
export class BuyerChatController {
  constructor(private readonly buyerChatService: BuyerChatService) {}

  // GET /api/buyer-chat/conversation?language=he — returns the conversation messages for the requested language.
  @Get('conversation')
  conversation(@Query('language') language: string): Promise<unknown[]> {
    return this.buyerChatService.findConversation(language);
  }
}
