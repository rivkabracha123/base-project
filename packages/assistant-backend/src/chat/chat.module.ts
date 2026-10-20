import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatConversationEntity } from '../database/chat-conversation.entity';
import { ProfilesModule } from '../profiles/profiles.module';
import { ChatController } from './chat.controller';
import { ChatConversationsController } from './chat-conversations.controller';
import { ChatConversationsService } from './chat-conversations.service';
import { ChatService } from './chat.service';

// Bundles the chat controller and service into one NestJS module.
@Module({
  imports: [
    ProfilesModule,
    TypeOrmModule.forFeature([ChatConversationEntity]),
  ],
  controllers: [ChatController, ChatConversationsController],
  providers: [ChatService, ChatConversationsService],
})
export class ChatModule {}
