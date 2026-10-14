import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetBuyerChatFlowForTests } from './buyer-chat-flow';
import { connectLevels } from './connect-levels';

// Helper: a fake buyer server. It answers POST /buyer/conversation/message with the updates
// that the given function builds from the buyer's text and language.
function stubBuyerServer(updatesFor: (message: string, language: string) => unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const { message, language } = JSON.parse(String(init?.body)) as { message: string; language: string };
      return new Response(
        JSON.stringify({ sessionId: 'session-1', updates: updatesFor(message, language), turn: {} }),
        { status: 200 },
      );
    }),
  );
}

beforeEach(() => resetBuyerChatFlowForTests());
afterEach(() => vi.unstubAllGlobals());

// Tests for the buyer's connection to the server: what the buyer sends comes back as updates for the screen.
describe('connectLevels', () => {
  // Verifies every update the server returns reaches the screen callback, in the order the server sent them.
  it('delivers the updates the server returns, in order', async () => {
    stubBuyerServer(() => [
      { speaker: 'system', text: 'What is your budget?' },
      { speaker: 'no-results', text: 'No matching items yet.' },
    ]);
    const received: unknown[] = [];

    await connectLevels('I am looking for a watch', (update) => received.push(update), 'en');

    expect(received).toEqual([
      { speaker: 'system', text: 'What is your budget?' },
      { speaker: 'no-results', text: 'No matching items yet.' },
    ]);
  });

  // Verifies the buyer's text and the screen language are what the server gets, by letting the fake server echo them back.
  it('sends the buyer text and the screen language to the server', async () => {
    stubBuyerServer((message, language) => [{ speaker: 'system', text: `${language}: ${message}` }]);
    const received: unknown[] = [];

    await connectLevels('I am looking for a watch', (update) => received.push(update), 'he');

    expect(received).toEqual([{ speaker: 'system', text: 'he: I am looking for a watch' }]);
  });

  it('reports a handled server failure through the callback without a second screen error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('server error', { status: 500 })));
    const onUpdate = vi.fn();
    await expect(connectLevels('I am looking for a watch', onUpdate, 'en')).resolves.toBeUndefined();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ speaker: 'error', code: 'buyer_chat_flow_failed', text: 'We could not send your message. Please try again.' });
  });
});
