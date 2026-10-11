import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { AiHistoryEntity } from '../database/ai-history.entity';
import { ProfilesService } from '../profiles/profiles.service';
import type { AiRole, GenerateAiRequestDto, GenerateAiResponseDto } from './ai.dto';

@Injectable()
export class AiHistoryService {
  constructor(
    @InjectRepository(AiHistoryEntity) private readonly history: Repository<AiHistoryEntity>,
    private readonly profiles: ProfilesService,
  ) {}

  async resolveUserId(sessionId?: string): Promise<string> {
    if (!sessionId?.trim() || sessionId.length > 200) {
      throw new BadRequestException('A valid anonymous session ID is required');
    }
    return (await this.profiles.getOrCreateBySessionId(sessionId)).id;
  }

  async validateConversation(userId: string, conversationId: string | undefined, role: AiRole): Promise<void> {
    if (!conversationId) return;
    const existing = await this.history.findOneBy({ userId, conversationId });
    if (!existing) throw new NotFoundException('Conversation not found');
    if (existing.role !== role) throw new BadRequestException('Start a new conversation to change buyer/seller role');
  }

  async conversation(sessionId: string | undefined, conversationId: string) {
    const userId = await this.resolveUserId(sessionId);
    const entries = await this.history.find({
      where: { userId, conversationId }, order: { createdAt: 'ASC', id: 'ASC' },
    });
    if (!entries.length) throw new NotFoundException('Conversation not found');
    return { conversationId, entries };
  }

  async record(userId: string, request: GenerateAiRequestDto, response: GenerateAiResponseDto): Promise<AiHistoryEntity> {
    return this.history.save(this.history.create({
      id: randomUUID(), conversationId: request.conversationId ?? randomUUID(), userId, prompt: request.prompt, role: request.role,
      language: request.language ?? 'he', response,
    }));
  }

  async list(sessionId: string | undefined, page: number) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) {
      throw new BadRequestException('Page must be an integer between 1 and 100000');
    }
    const userId = await this.resolveUserId(sessionId);
    const pageSize = 20;
    const [items, total] = await this.history.findAndCount({
      where: { userId }, order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize, take: pageSize,
    });
    return { items, total, page, pageSize };
  }
}
