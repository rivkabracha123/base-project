import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
   * Creates or updates the complete chat snapshot after verifying profile ownership.
   * יוצרת או מעדכנת את תמונת השיחה המלאה לאחר אימות הבעלות של הפרופיל.
   */
  async saveSnapshot(
    anonymousSessionId: string | undefined,
    conversationId: string,
    snapshot: SaveChatSnapshotDto,
  ): Promise<{ conversationId: string; version: number; status: string }> {
    if (!anonymousSessionId?.trim() || anonymousSessionId.length > 200) {
      throw new BadRequestException('A valid anonymous session ID is required');
    }

    const profile = await this.profiles.getOrCreateBySessionId(anonymousSessionId);
    const status = snapshot.completed ? 'completed' : 'active';
    const endedAt = snapshot.completed ? new Date() : null;

    // כתיבה מותנית אטומית מונעת מ-snapshot ישן או מפרופיל אחר לדרוס את השיחה.
    const inserted = await this.conversations.query(
      `INSERT INTO "chat_conversations" (
         "id", "user_id", "role", "language", "status", "messages",
         "snapshot_version", "ended_at"
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       ON CONFLICT ("id") DO UPDATE SET
         "messages" = EXCLUDED."messages",
         "snapshot_version" = EXCLUDED."snapshot_version",
         "status" = CASE
           WHEN EXCLUDED."status" = 'completed' THEN 'completed'
           ELSE "chat_conversations"."status"
         END,
         "updated_at" = now(),
         "ended_at" = CASE
           WHEN EXCLUDED."status" = 'completed'
             THEN COALESCE("chat_conversations"."ended_at", EXCLUDED."ended_at")
           ELSE "chat_conversations"."ended_at"
         END
       WHERE "chat_conversations"."user_id" = EXCLUDED."user_id"
         AND "chat_conversations"."role" = EXCLUDED."role"
         AND "chat_conversations"."language" = EXCLUDED."language"
         AND "chat_conversations"."snapshot_version" < EXCLUDED."snapshot_version"
       RETURNING "id"`,
      [
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

    const saved = await this.conversations.findOneBy({ id: conversationId });
    if (!saved || saved.userId !== profile.id) {
      throw new NotFoundException('Conversation not found');
    }

    if (saved.role !== snapshot.role || saved.language !== snapshot.language) {
      throw new BadRequestException('Conversation role and language cannot be changed');
    }

    // אם הכתיבה המותנית לא החזירה שורה, זו גרסה ישנה או שווה שכבר נשמרה.
    if (inserted.length === 0 && saved.snapshotVersion < snapshot.version) {
      throw new Error('Chat snapshot could not be saved');
    }

    return {
      conversationId: saved.id,
      version: saved.snapshotVersion,
      status: saved.status,
    };
  }
}
