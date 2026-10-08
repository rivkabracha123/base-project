import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BuyerChatUpdate } from './buyer-chat-updates';
import { BUYER_CHAT_SKIP, resetBuyerChatFlowForTests, submitBuyerChatMessage } from './buyer-chat-flow';

describe('submitBuyerChatMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetBuyerChatFlowForTests();
  });

  it('calls onUpdate for each server update after first message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/buyer/conversation/message')) {
          return new Response(
            JSON.stringify({
              sessionId: 'session-1',
              updates: [{ speaker: 'system', text: 'Is there a specific artist?' }],
            }),
            { status: 200 },
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const updates: BuyerChatUpdate[] = [];
    await submitBuyerChatMessage('blue painting', (update) => updates.push(update));

    expect(updates).toEqual([{ speaker: 'system', text: 'Is there a specific artist?' }]);
  });

  it('forwards sessionId on follow-up messages', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/buyer/conversation/message')) {
        const body = JSON.parse(String(init?.body)) as { sessionId?: string; message: string };
        if (!body.sessionId) {
          return new Response(
            JSON.stringify({
              sessionId: 'session-2',
              updates: [{ speaker: 'system', text: 'Artist?' }],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            sessionId: 'session-2',
            updates: [{ speaker: 'system', text: 'Location?' }],
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await submitBuyerChatMessage('painting', () => {});
    await submitBuyerChatMessage(BUYER_CHAT_SKIP, () => {});

    const secondCallBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      sessionId?: string;
      message: string;
    };
    expect(secondCallBody.sessionId).toBe('session-2');
    expect(secondCallBody.message).toBe(BUYER_CHAT_SKIP);
  });
});
