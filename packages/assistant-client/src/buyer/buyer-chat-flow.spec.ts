import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BuyerChatUpdate } from './buyer-chat-updates';
import { BUYER_CHAT_SKIP, getBuyerChatFlowSnapshot, restoreBuyerChatFlowState, selectBuyerLot, resetBuyerChatFlowForTests, submitBuyerChatMessage } from './buyer-chat-flow';
import { soldLotFixture } from '../test/fixtures/auction-lots';

describe('submitBuyerChatMessage', () => {
  it('resolves the first result before sending a natural-language details request', async () => {
    restoreBuyerChatFlowState({ sessionId: 'session-ordinal', results: [soldLotFixture] });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ sessionId: 'session-ordinal',
      turn: { p4: { intentRoute: { functionName: 'getLotById' } } },
      updates: [{ speaker: 'result-group', title: 'Item details', lots: [soldLotFixture] }],
    })));
    vi.stubGlobal('fetch', fetchMock);
    await submitBuyerChatMessage('תראה לי פרטים נוספים על הפריט הראשון', vi.fn(), { language: 'he' });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.context.selectedLot.id).toBe(soldLotFixture.id);
  });

  it('saves a clearly labeled local demo alert without claiming real monitoring', async () => {
    localStorage.removeItem('monabid-buyer-demo-alerts');
    restoreBuyerChatFlowState({ results: [soldLotFixture] });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const onUpdate = vi.fn();
    await submitBuyerChatMessage('תודיע לי אם כתב יד כזה עולה למכירה', onUpdate, { language: 'he' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('monabid-buyer-demo-alerts')!)).toHaveLength(1);
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('אין מעקב אמיתי') }));
    localStorage.removeItem('monabid-buyer-demo-alerts');
  });
  it('keeps the selected canonical item for subsequent history requests', () => {
    selectBuyerLot(soldLotFixture);
    expect(getBuyerChatFlowSnapshot().context.selectedLot?.id).toBe(soldLotFixture.id);
  });
  it('shows one localized service error without leaking the raw server response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ statusCode: 503, message: 'AI generate failed', path: '/api/buyer/conversation/message' }), { status: 503 })));
    const onUpdate = vi.fn();
    await expect(submitBuyerChatMessage('טבעת כחולה', onUpdate, { language: 'he' })).resolves.toBeUndefined();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ speaker: 'error', code: 'buyer_chat_flow_failed', text: '\u05e9\u05d9\u05e8\u05d5\u05ea \u05d4\u05beAI \u05dc\u05d0 \u05d6\u05de\u05d9\u05df \u05db\u05e8\u05d2\u05e2. \u05e0\u05e1\u05d9 \u05e9\u05d5\u05d1 \u05de\u05d0\u05d5\u05d7\u05e8 \u05d9\u05d5\u05ea\u05e8.' });
  });
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
