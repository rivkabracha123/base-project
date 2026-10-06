import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BuyerUpdate } from '../chat/chat-types';
import { BUYER_CHAT_SKIP, connectLevels, resetConnectLevelsSessionForTests } from './connect-levels';

describe('connectLevels', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetConnectLevelsSessionForTests();
  });

  it('calls onUpdate with system text after extract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/buyer/conversation/open')) {
          return new Response(
            JSON.stringify({
              chat: {
                id: 'sys-1',
                sessionId: 'session-1',
                speaker: 'system',
                text: 'Is there a specific artist?',
                date: '2026-10-06T10:00:00.000Z',
              },
              ai: { readyForFunction: false, intentRoute: { functionName: null, readyForFunction: false } },
            }),
            { status: 200 },
          );
        }
        if (url.includes('/sessions/session-1') && !url.includes('/review') && !url.includes('/search')) {
          return new Response(
            JSON.stringify({
              criteria: { language: 'en' },
              conversation: { missing: ['creator'] },
            }),
            { status: 200 },
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const updates: BuyerUpdate[] = [];
    await connectLevels('blue painting', (update) => updates.push(update));

    expect(updates).toEqual([{ speaker: 'system', text: 'Is there a specific artist?' }]);
  });

  it('runs search updates when criteria are complete', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/buyer/conversation/open')) {
          return new Response(
            JSON.stringify({
              chat: {
                id: 'sys-1',
                sessionId: 'session-2',
                speaker: 'system',
                text: 'Ready?',
                date: '2026-10-06T10:00:00.000Z',
              },
              ai: { readyForFunction: true, intentRoute: { functionName: 'searchLots', readyForFunction: true } },
            }),
            { status: 200 },
          );
        }
        if (url.includes('/ai/readiness')) {
          return new Response(
            JSON.stringify({ readyForFunction: true, functionName: 'searchLots' }),
            { status: 200 },
          );
        }
        if (url.includes('/review')) {
          return new Response(JSON.stringify({ summary: 'Search criteria review:\nCategory: painting' }), {
            status: 200,
          });
        }
        if (url.includes('/search') && init?.method === 'POST' && !url.includes('/ai/')) {
          return new Response(
            JSON.stringify({
              kind: 'results',
              groups: [{ title: 'Upcoming lots', lots: [{ id: 'lot-1' }] }],
            }),
            { status: 200 },
          );
        }
        if (url.includes('/sessions/session-2')) {
          return new Response(
            JSON.stringify({
              criteria: { language: 'en' },
              conversation: { missing: [] },
            }),
            { status: 200 },
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const updates: BuyerUpdate[] = [];
    await connectLevels('painting under 10k', (update) => updates.push(update));

    expect(updates.some((u) => u.speaker === 'results-found')).toBe(true);
    expect(updates.some((u) => u.speaker === 'result-group')).toBe(true);
  });

  it('supports skip sentinel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/buyer/conversation/open')) {
          return new Response(
            JSON.stringify({
              chat: {
                id: 'sys-1',
                sessionId: 'session-3',
                speaker: 'system',
                text: 'Artist?',
                date: '2026-10-06T10:00:00.000Z',
              },
              ai: { readyForFunction: false, intentRoute: { functionName: null, readyForFunction: false } },
            }),
            { status: 200 },
          );
        }
        if (url.endsWith('/buyer/criteria/turn')) {
          return new Response(
            JSON.stringify({
              id: 'sys-2',
              sessionId: 'session-3',
              speaker: 'system',
              text: 'Location?',
              date: '2026-10-06T10:01:00.000Z',
            }),
            { status: 200 },
          );
        }
        if (url.includes('/sessions/session-3') && !url.includes('/review') && !url.includes('/search')) {
          return new Response(
            JSON.stringify({
              criteria: { language: 'en' },
              conversation: { missing: ['location'] },
            }),
            { status: 200 },
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    await connectLevels('painting', () => {});
    const updates: BuyerUpdate[] = [];
    await connectLevels(BUYER_CHAT_SKIP, (update) => updates.push(update));

    expect(updates[0]).toEqual({ speaker: 'system', text: 'Location?' });
  });
});
