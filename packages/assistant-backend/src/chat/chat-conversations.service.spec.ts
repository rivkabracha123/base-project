import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { ChatConversationEntity } from '../database/chat-conversation.entity';
import { ProfilesService } from '../profiles/profiles.service';
import { ChatConversationsService } from './chat-conversations.service';

describe('ChatConversationsService', () => {
  let service: ChatConversationsService;
  const savedConversation: ChatConversationEntity = {
    id: '5340e521-37da-4c14-8dc3-fc6840b2ffce',
    userId: 'profile-1',
    role: 'seller',
    language: 'he',
    status: 'active',
    messages: [{ speaker: 'seller', text: 'מחפשת למכור פריט' }],
    snapshotVersion: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    endedAt: null,
  };
  const repository = {
    query: jest.fn(),
    findOneBy: jest.fn(),
  };
  const profiles = {
    getOrCreateBySessionId: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    profiles.getOrCreateBySessionId.mockResolvedValue({ id: 'profile-1' });
    repository.query.mockResolvedValue([{ id: savedConversation.id }]);
    repository.findOneBy.mockResolvedValue(savedConversation);

    const module = await Test.createTestingModule({
      providers: [
        ChatConversationsService,
        {
          provide: getRepositoryToken(ChatConversationEntity),
          useValue: repository,
        },
        { provide: ProfilesService, useValue: profiles },
      ],
    }).compile();

    service = module.get(ChatConversationsService);
  });

  it('saves the whole chat snapshot for the profile resolved from the browser session', async () => {
    const result = await service.saveSnapshot(
      'anonymous-session-1',
      savedConversation.id,
      {
        role: 'seller',
        language: 'he',
        version: 1,
        messages: savedConversation.messages,
      },
    );

    expect(profiles.getOrCreateBySessionId).toHaveBeenCalledWith('anonymous-session-1');
    expect(repository.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT ("id") DO UPDATE'),
      expect.arrayContaining([
        savedConversation.id,
        'profile-1',
        'seller',
        'he',
        'active',
        JSON.stringify(savedConversation.messages),
        1,
        null,
      ]),
    );
    expect(result).toEqual({
      conversationId: savedConversation.id,
      version: 1,
      status: 'active',
    });
  });

  it('does not return a conversation owned by another profile', async () => {
    repository.findOneBy.mockResolvedValue({
      ...savedConversation,
      userId: 'another-profile',
    });

    await expect(
      service.saveSnapshot('anonymous-session-1', savedConversation.id, {
        role: 'seller',
        language: 'he',
        version: 1,
        messages: savedConversation.messages,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not reassign a conversation to a different role or language', async () => {
    repository.findOneBy.mockResolvedValue({
      ...savedConversation,
      role: 'buyer',
    });

    await expect(
      service.saveSnapshot('anonymous-session-1', savedConversation.id, {
        role: 'seller',
        language: 'he',
        version: 2,
        messages: savedConversation.messages,
      }),
    ).rejects.toThrow('Conversation role and language cannot be changed');
  });
});
