import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { ChatConversationEntity } from '../database/chat-conversation.entity';
import { ProfilesService } from '../profiles/profiles.service';
import { ChatConversationsService } from './chat-conversations.service';

describe('ChatConversationsService', () => {
  let service: ChatConversationsService;
  const savedConversation: ChatConversationEntity = {
    messageId: '9a1b5c0e-2f7d-4c3a-8e6b-1d2f3a4b5c6d',
    conversationId: '5340e521-37da-4c14-8dc3-fc6840b2ffce',
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
    findOne: jest.fn(),
  };
  const profiles = {
    getOrCreateBySessionId: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    profiles.getOrCreateBySessionId.mockResolvedValue({ id: 'profile-1' });
    repository.query.mockResolvedValue([]);
    repository.findOne.mockResolvedValue(savedConversation);

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

  it('saves the first chat snapshot as a new row for the profile resolved from the browser session', async () => {
    repository.findOne.mockResolvedValueOnce(null);

    const result = await service.saveSnapshot(
      'anonymous-session-1',
      savedConversation.conversationId,
      {
        role: 'seller',
        language: 'he',
        version: 1,
        messages: savedConversation.messages,
      },
    );

    expect(profiles.getOrCreateBySessionId).toHaveBeenCalledWith('anonymous-session-1');
    expect(repository.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT ("conversation_id", "snapshot_version") DO NOTHING'),
      [
        expect.any(String),
        savedConversation.conversationId,
        'profile-1',
        'seller',
        'he',
        'active',
        JSON.stringify(savedConversation.messages),
        1,
        null,
      ],
    );
    expect(result).toEqual({
      conversationId: savedConversation.conversationId,
      messageId: savedConversation.messageId,
      version: 1,
      status: 'active',
    });
  });

  it('adds every newer change as another row under the same conversation ID', async () => {
    const messages = [...savedConversation.messages, { speaker: 'assistant', text: 'מה הפריט?' }];
    repository.findOne
      .mockResolvedValueOnce(savedConversation)
      .mockResolvedValueOnce({
        ...savedConversation,
        messageId: '0f1e2d3c-4b5a-4968-8776-655443322110',
        snapshotVersion: 2,
        messages,
      });

    const result = await service.saveSnapshot(
      'anonymous-session-1',
      savedConversation.conversationId,
      { role: 'seller', language: 'he', version: 2, messages },
    );

    const [, params] = repository.query.mock.calls[0];
    expect(params[0]).not.toBe(savedConversation.messageId);
    expect(params[1]).toBe(savedConversation.conversationId);
    expect(params[7]).toBe(2);
    expect(result).toEqual({
      conversationId: savedConversation.conversationId,
      messageId: '0f1e2d3c-4b5a-4968-8776-655443322110',
      version: 2,
      status: 'active',
    });
  });

  it('does not insert a row for an old or already saved version', async () => {
    const result = await service.saveSnapshot(
      'anonymous-session-1',
      savedConversation.conversationId,
      {
        role: 'seller',
        language: 'he',
        version: 1,
        messages: savedConversation.messages,
      },
    );

    expect(repository.query).not.toHaveBeenCalled();
    expect(result.messageId).toBe(savedConversation.messageId);
  });

  it('does not return a conversation owned by another profile', async () => {
    repository.findOne.mockResolvedValue({
      ...savedConversation,
      userId: 'another-profile',
    });

    await expect(
      service.saveSnapshot('anonymous-session-1', savedConversation.conversationId, {
        role: 'seller',
        language: 'he',
        version: 2,
        messages: savedConversation.messages,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.query).not.toHaveBeenCalled();
  });

  it('does not reassign a conversation to a different role or language', async () => {
    repository.findOne.mockResolvedValue({
      ...savedConversation,
      role: 'buyer',
    });

    await expect(
      service.saveSnapshot('anonymous-session-1', savedConversation.conversationId, {
        role: 'seller',
        language: 'he',
        version: 2,
        messages: savedConversation.messages,
      }),
    ).rejects.toThrow('Conversation role and language cannot be changed');
  });
});
