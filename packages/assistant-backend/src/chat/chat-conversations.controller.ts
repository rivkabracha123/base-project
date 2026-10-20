import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ChatConversationsService } from './chat-conversations.service';
import { SaveChatSnapshotDto } from './save-chat-snapshot.dto';

@Controller('chat/conversations')
export class ChatConversationsController {
  constructor(private readonly conversations: ChatConversationsService) {}

  /**
   * Accepts a validated chat snapshot and passes it to the persistence service.
   * מקבלת תמונת שיחה שעברה ולידציה ומעבירה אותה לשירות השמירה.
   */
  @Put(':conversationId/snapshot')
  saveSnapshot(
    @Headers('x-anonymous-session-id') anonymousSessionId: string | undefined,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() body: SaveChatSnapshotDto,
  ) {
    return this.conversations.saveSnapshot(
      anonymousSessionId,
      conversationId,
      body,
    );
  }
}
