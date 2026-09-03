import { Controller, Get, Query } from '@nestjs/common';
import { ChatService } from './chat.service';

// Handles HTTP requests for the chat conversation and delegates them to the service.
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // GET /api/chat/conversation?language=he — returns the conversation messages for the requested language.
  @Get('conversation')
  conversation(@Query('language') language: string): Promise<unknown[]> {
    return this.chatService.findConversation(language);
  }
}
