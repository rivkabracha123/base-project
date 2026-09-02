import { afterEach, describe, expect, it, vi } from 'vitest';
import conversationFixture from '../../../../fixtures/demo-scenarios/buyer-conversation.json';
import { getConversation } from './api';

afterEach(() => vi.unstubAllGlobals());

// Tests for getConversation — fetches a conversation from the backend and validates it.
describe('getConversation', () => {
  // Verifies it fetches a bilingual conversation, returns it unchanged, and calls the right URL with the language param.
  it('fetches and validates a real bilingual conversation from the backend', async () => {
    const sample = conversationFixture.conversations.he;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(sample), { status: 200 })));

    await expect(getConversation('he')).resolves.toEqual(sample);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/chat/conversation?language=he',
      expect.objectContaining({ signal: undefined }),
    );
  });

  // Verifies invalid messages returned by the API are dropped before they reach the rest of the code.
  it('drops any invalid messages returned by the API before exposing them', async () => {
    const validMessage = {
      kind: 'buyer',
      id: 'incoming-1',
      at: '2026-01-01T10:00:00.000Z',
      text: 'שלום',
    };
    const responseBody = [
      { kind: 'banana', id: 'bad-1', at: '2026-01-01T10:00:01.000Z', text: 'x' },
      validMessage,
      { kind: 'assistant', id: 'bad-2', at: '2026-01-01T10:00:02.000Z' },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 })));

    await expect(getConversation('he')).resolves.toEqual([validMessage]);
  });
});
