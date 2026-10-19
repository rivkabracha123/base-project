import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BuyerChatUpdate } from './buyer-chat-updates';
import { BUYER_CHAT_SKIP, getBuyerChatFlowSnapshot, restoreBuyerChatFlowState, selectBuyerLot, resetBuyerChatFlowForTests, submitBuyerChatMessage } from './buyer-chat-flow';
import { soldLotFixture } from '../test/fixtures/auction-lots';

function streamResponse(sessionId: string, updates: unknown[], turn: unknown = {}) {
  const events = [
    { type: 'started' },
    { type: 'session', sessionId },
    ...updates.flatMap((update, index) => {
      const speaker = (update as { speaker?: string }).speaker;
      return speaker === 'system' || speaker === 'results-found'
        ? [{ type: 'update', index, update }]
        : [];
    }),
    { type: 'complete', response: { sessionId, updates, turn } },
  ];
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('submitBuyerChatMessage', () => {
  it('resolves the first result before sending a natural-language details request', async () => {
    restoreBuyerChatFlowState({ sessionId: 'session-ordinal', results: [soldLotFixture] });
    const fetchMock = vi.fn().mockResolvedValue(streamResponse('session-ordinal',
      [{ speaker: 'result-group', title: 'Item details', lots: [soldLotFixture] }],
      { p4: { intentRoute: { functionName: 'getLotById' } } },
    ));
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
        if (url.endsWith('/buyer/conversation/message/stream')) {
          return streamResponse('session-1', [{ speaker: 'system', text: 'Is there a specific artist?' }]);
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
      if (url.endsWith('/buyer/conversation/message/stream')) {
        const body = JSON.parse(String(init?.body)) as { sessionId?: string; message: string };
        if (!body.sessionId) {
          return streamResponse('session-2', [{ speaker: 'system', text: 'Artist?' }]);
        }
        return streamResponse('session-2', [{ speaker: 'system', text: 'Location?' }]);
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

  it('renders a streamed search update before the request completes', async () => {
    const onUpdate = vi.fn();
    let finish!: () => void;
    const encoder = new TextEncoder();
    const fetchMock = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'started' })}\n\n` +
          `data: ${JSON.stringify({ type: 'session', sessionId: 'session-live' })}\n\n` +
          `data: ${JSON.stringify({ type: 'update', index: 0, update: { speaker: 'system', text: 'Searching for lots by category: rings…' } })}\n\n`,
        ));
        finish = () => {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'complete', response: { sessionId: 'session-live', updates: [{ speaker: 'system', text: 'Searching for lots by category: rings…' }], turn: {} } })}\n\n`,
          ));
          controller.close();
        };
      },
    }), { headers: { 'Content-Type': 'text/event-stream' } }));
    vi.stubGlobal('fetch', fetchMock);

    const request = submitBuyerChatMessage('I want a ring', onUpdate, { language: 'en' });
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith({
      speaker: 'system',
      text: 'Searching for lots by category: rings…',
    }));
    finish();
    await request;
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
