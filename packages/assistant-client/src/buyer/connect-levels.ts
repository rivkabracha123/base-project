import type { AuctionLot } from '@monabid/shared';
import type { BuyerUpdate } from '../chat/chat-types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

/** Pass as message when the buyer taps Skip — not shown in the chat. */
export const BUYER_CHAT_SKIP = '__monabid_skip__';

export type ConnectLevelsContext = {
  selectedLot?: { id: string } | null;
  lots?: AuctionLot[];
};

export type ConnectLevelsOptions = {
  language?: 'he' | 'en';
  context?: ConnectLevelsContext;
};

type BuyerChatSystemMessage = {
  id: string;
  sessionId: string;
  speaker: 'system';
  text: string;
  date: string;
};

type SessionSnapshot = {
  criteria: { language: 'he' | 'en' };
  conversation: { missing: string[] };
};

type SearchResponse =
  | { kind: 'results'; groups: { title: string; lots: AuctionLot[] }[] }
  | { kind: 'unmatched'; message: string };

type ReadinessResponse = {
  readyForFunction: boolean;
  functionName: string | null;
};

let activeSessionId: string | null = null;
let activeLanguage: 'he' | 'en' = 'en';
let activeContext: ConnectLevelsContext = {};

function toP4Context(context: ConnectLevelsContext, sessionId?: string) {
  return {
    sessionId,
    selectedLot: context.selectedLot ?? null,
    lots: context.lots?.map((lot) => ({ id: lot.id })),
  };
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

async function postOpenConversation(message: string): Promise<BuyerChatSystemMessage> {
  const response = await fetch(`${apiBaseUrl}/buyer/conversation/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      language: activeLanguage,
      context: toP4Context(activeContext),
    }),
  });
  const body = await readJson<{ chat: BuyerChatSystemMessage; ai: ReadinessResponse }>(response);
  return body.chat;
}

async function postTurn(body: Record<string, unknown>): Promise<BuyerChatSystemMessage> {
  const response = await fetch(`${apiBaseUrl}/buyer/criteria/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readJson(response);
}

async function fetchSessionSnapshot(sessionId: string): Promise<SessionSnapshot> {
  const response = await fetch(`${apiBaseUrl}/buyer/sessions/${encodeURIComponent(sessionId)}`);
  return readJson(response);
}

async function fetchReviewSummary(sessionId: string): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/buyer/sessions/${encodeURIComponent(sessionId)}/review`);
  const body = await readJson<{ summary: string }>(response);
  return body.summary;
}

async function postReadiness(sessionId: string): Promise<ReadinessResponse> {
  const response = await fetch(
    `${apiBaseUrl}/buyer/sessions/${encodeURIComponent(sessionId)}/ai/readiness`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: toP4Context(activeContext, sessionId) }),
    },
  );
  return readJson(response);
}

async function postSearch(sessionId: string): Promise<SearchResponse> {
  const response = await fetch(`${apiBaseUrl}/buyer/sessions/${encodeURIComponent(sessionId)}/search`, {
    method: 'POST',
  });
  return readJson(response);
}

async function maybeRunSearch(sessionId: string, onUpdate: (update: BuyerUpdate) => void): Promise<void> {
  const snapshot = await fetchSessionSnapshot(sessionId);
  if (snapshot.conversation.missing.length > 0) {
    return;
  }

  const readiness = await postReadiness(sessionId);
  if (!readiness.readyForFunction) {
    return;
  }

  if (readiness.functionName === 'findSimilarItems') {
    onUpdate({
      speaker: 'error',
      code: 'similar_not_wired',
      text:
        snapshot.criteria.language === 'he'
          ? 'חיפוש פריטים דומים עדיין לא מחובר — B3/B4.'
          : 'Similar items search is not wired yet (B3/B4).',
    });
    return;
  }

  if (readiness.functionName && readiness.functionName !== 'searchLots') {
    return;
  }

  const summary = await fetchReviewSummary(sessionId);
  onUpdate({ speaker: 'system', text: summary });

  const search = await postSearch(sessionId);
  if (search.kind === 'unmatched') {
    onUpdate({ speaker: 'no-results', text: search.message });
    return;
  }

  const totalLots = search.groups.reduce((count, group) => count + group.lots.length, 0);
  const language = snapshot.criteria.language;
  onUpdate({
    speaker: 'results-found',
    text:
      language === 'he'
        ? `מצאנו ${totalLots} פריטים שמתאימים לבקשה.`
        : `Found ${totalLots} lots that match this request.`,
  });

  for (const group of search.groups) {
    if (group.lots.length === 0) continue;
    onUpdate({ speaker: 'result-group', lots: group.lots });
  }
}

/**
 * B1 entry: buyer message → Shilat (P4) → B2 criteria → search when P4 readyForFunction allows.
 */
export async function connectLevels(
  message: string,
  onUpdate: (update: BuyerUpdate) => void,
  options?: ConnectLevelsOptions,
): Promise<void> {
  const trimmed = message.trim();
  const isSkip = trimmed === BUYER_CHAT_SKIP;

  if (!isSkip && trimmed.length === 0) {
    throw new Error('Buyer message must not be empty.');
  }

  if (options?.language) {
    activeLanguage = options.language;
  }
  if (options?.context) {
    activeContext = options.context;
  }

  try {
    const at = new Date().toISOString();

    if (!activeSessionId) {
      if (isSkip) {
        throw new Error('Cannot skip before the first buyer message.');
      }
      if (!options?.language && /[\u0590-\u05FF]/.test(trimmed)) {
        activeLanguage = 'he';
      } else if (!options?.language) {
        activeLanguage = 'en';
      }

      const started = await postOpenConversation(trimmed);
      activeSessionId = started.sessionId;
      onUpdate({ speaker: 'system', text: started.text });
      await maybeRunSearch(activeSessionId, onUpdate);
      return;
    }

    const turn = isSkip
      ? {
          id: `buyer-${at}`,
          sessionId: activeSessionId,
          speaker: 'buyer' as const,
          skipped: true as const,
          date: at,
        }
      : {
          id: `buyer-${at}`,
          sessionId: activeSessionId,
          speaker: 'buyer' as const,
          skipped: false as const,
          text: trimmed,
          date: at,
        };

    const reply = await postTurn(turn);
    onUpdate({ speaker: 'system', text: reply.text });
    await maybeRunSearch(activeSessionId, onUpdate);
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Unknown error';
    onUpdate({ speaker: 'error', code: 'connect_levels_failed', text });
    throw error;
  }
}

/** Test helper — reset module session between tests. */
export function resetConnectLevelsSessionForTests(): void {
  activeSessionId = null;
  activeLanguage = 'en';
  activeContext = {};
}
