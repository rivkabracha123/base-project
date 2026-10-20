import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { ChatConversationEntity } from '../database/chat-conversation.entity';
import { ProfilesService } from '../profiles/profiles.service';
import { SaveChatSnapshotDto } from './save-chat-snapshot.dto';

@Injectable()
export class ChatConversationsService {
  constructor(
    @InjectRepository(ChatConversationEntity)
    private readonly conversations: Repository<ChatConversationEntity>,
    private readonly profiles: ProfilesService,
  ) {}

  /**
   * Saves every chat change as a new row (messageId) under the same conversationId.
   * שומרת כל שינוי בשיחה כשורה חדשה (messageId) תחת אותו מזהה שיחה, לאחר אימות הבעלות של הפרופיל.
   */
  async saveSnapshot(
    anonymousSessionId: string | undefined,
    conversationId: string,
    snapshot: SaveChatSnapshotDto,
  ): Promise<{ conversationId: string; messageId: string; version: number; status: string }> {
    if (!anonymousSessionId?.trim() || anonymousSessionId.length > 200) {
      throw new BadRequestException('A valid anonymous session ID is required');
    }

    const profile = await this.profiles.getOrCreateBySessionId(anonymousSessionId);
    const latest = await this.findLatest(conversationId);

    if (latest) {
      if (latest.userId !== profile.id) {
        throw new NotFoundException('Conversation not found');
      }
      if (latest.role !== snapshot.role || latest.language !== snapshot.language) {
        throw new BadRequestException('Conversation role and language cannot be changed');
      }
      // גרסה ישנה או שווה כבר נשמרה - לא יוצרים שורה חדשה.
      if (latest.snapshotVersion >= snapshot.version) {
        return this.toResult(latest);
      }
    }

    // שיחה שהסתיימה נשארת מסומנת כ-completed גם בגרסאות הבאות.
    const completed = snapshot.completed || latest?.status === 'completed';
    const status = completed ? 'completed' : 'active';
    const endedAt = completed ? (latest?.endedAt ?? new Date()) : null;

    // האינדקס הייחודי על (conversation_id, snapshot_version) מונע כפילות בשמירות מקבילות.
    await this.conversations.query(
      `INSERT INTO "chat_conversations" (
         "message_id", "conversation_id", "user_id", "role", "language", "status",
         "messages", "snapshot_version", "ended_at"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
       ON CONFLICT ("conversation_id", "snapshot_version") DO NOTHING`,
      [
        randomUUID(),
        conversationId,
        profile.id,
        snapshot.role,
        snapshot.language,
        status,
        JSON.stringify(snapshot.messages),
        snapshot.version,
        endedAt,
      ],
    );

    const saved = await this.findLatest(conversationId);
    if (!saved || saved.userId !== profile.id) {
      throw new NotFoundException('Conversation not found');
    }

    return this.toResult(saved);
  }

  /**
   * Returns the newest saved version of a conversation, if any.
   * מחזירה את הגרסה האחרונה שנשמרה עבור השיחה, אם קיימת.
   */
  private findLatest(conversationId: string): Promise<ChatConversationEntity | null> {
    return this.conversations.findOne({
      where: { conversationId },
      order: { snapshotVersion: 'DESC' },
    });
  }

  private toResult(row: ChatConversationEntity) {
    return {
      conversationId: row.conversationId,
      messageId: row.messageId,
      version: row.snapshotVersion,
      status: row.status,
    };
  }
}
