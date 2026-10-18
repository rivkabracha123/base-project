import type { AuctionLot } from '@monabid/shared';
import { BuyerApiError, buyerApiBaseUrl } from './buyer-api';
import type { BuyerChatTurnLog } from './buyer-chat-storage';
import type { BuyerChatUpdate } from './buyer-chat-updates';
import { detectBuyerLanguage } from './detect-buyer-language';

/** Same sentinel as backend `BUYER_CHAT_SKIP`. */
export const BUYER_CHAT_SKIP = '__monabid_skip__';

export type BuyerChatFlowContext = {
  selectedLot?: { id: string; itemKey?: string } | null;
  lots?: Pick<AuctionLot, 'id'>[];
};

export type BuyerChatFlowOptions = {
  language?: 'he' | 'en';
  context?: BuyerChatFlowContext;
  onSessionId?: (sessionId: string) => void;
  /** Full turn from B2 (buyer + Shilat p4 + updates) — append to localStorage. */
  onTurnLog?: (turn: BuyerChatTurnLog) => void;
};

type ConversationMessageResponse = {
  sessionId: string;
  updates: BuyerChatUpdate[];
  turn: BuyerChatTurnLog;
};

type ConversationMessageStreamEvent =
  | { type: 'started' }
  | { type: 'session'; sessionId: string }
  | { type: 'update'; index: number; update: BuyerChatUpdate }
  | { type: 'complete'; response: ConversationMessageResponse }
  | { type: 'failure'; status: number };

async function readConversationMessageStream(
  response: Response,
  onUpdate: (update: BuyerChatUpdate) => void,
  onSessionId: (sessionId: string) => void,
): Promise<{ response: ConversationMessageResponse; streamedUpdateIndexes: Set<number> }> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Buyer conversation stream has no response body.');

  const decoder = new TextDecoder();
  const streamedUpdateIndexes = new Set<number>();
  let buffer = '';
  let completedResponse: ConversationMessageResponse | undefined;

  const processFrame = (frame: string): void => {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) return;

    const event = JSON.parse(data) as ConversationMessageStreamEvent;
    switch (event.type) {
      case 'started':
        break;
      case 'session':
        activeSessionId = event.sessionId;
        onSessionId(event.sessionId);
        break;
      case 'update':
        if (!Number.isInteger(event.index)) throw new Error('Invalid buyer conversation stream update index.');
        streamedUpdateIndexes.add(event.index);
        onUpdate(event.update);
        break;
      case 'complete':
        completedResponse = event.response;
        break;
      case 'failure':
        if (!Number.isInteger(event.status) || event.status < 400 || event.status > 599) {
          throw new Error('Invalid buyer conversation stream failure status.');
        }
        throw new BuyerApiError(event.status);
      default:
        throw new Error('Unknown buyer conversation stream event.');
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let separator = /\r?\n\r?\n/.exec(buffer);
    while (separator?.index !== undefined) {
      processFrame(buffer.slice(0, separator.index));
      buffer = buffer.slice(separator.index + separator[0].length);
      separator = /\r?\n\r?\n/.exec(buffer);
    }

    if (done) break;
  }

  if (buffer.trim()) processFrame(buffer);
  if (!completedResponse) throw new Error('Buyer conversation stream ended before completion.');
  return { response: completedResponse, streamedUpdateIndexes };
}

let activeSessionId: string | null = null;
let activeLanguage: 'he' | 'en' = 'en';
let activeContext: BuyerChatFlowContext = {};
let latestResultLots: AuctionLot[] = [];
let houseCategory: string | undefined;
export function getBuyerHouseCategory(): string | undefined { return houseCategory; }

export function getLatestBuyerResultLots(): AuctionLot[] { return latestResultLots; }

export function selectBuyerLot(lot: AuctionLot): void {
  activeContext = { ...activeContext, selectedLot: { id: lot.id, ...(lot.itemKey ? { itemKey: lot.itemKey } : {}) } };
}

function toP4AiContext(context: BuyerChatFlowContext, sessionId?: string) {
  return {
    sessionId,
    selectedLot: context.selectedLot
      ? {
          id: context.selectedLot.id,
          ...(context.selectedLot.itemKey ? { itemKey: context.selectedLot.itemKey } : {}),
        }
      : null,
    lots: context.lots?.map((lot) => ({ id: lot.id })),
  };
}

export function restoreBuyerChatFlowState(state: {
  sessionId?: string;
  language?: 'he' | 'en';
  context?: BuyerChatFlowContext;
  results?: AuctionLot[];
}): void {
  if (state.results) latestResultLots = state.results;
  activeSessionId = state.sessionId ?? null;
  if (state.language) {
    activeLanguage = state.language;
  }
  if (state.context) {
    activeContext = state.context;
  }
}

export function getBuyerChatFlowSnapshot(): {
  sessionId: string | null;
  language: 'he' | 'en';
  context: BuyerChatFlowContext;
} {
  return {
    sessionId: activeSessionId,
    language: activeLanguage,
    context: activeContext,
  };
}

/**
 * B1 → B2: one buyer message; server calls Shilat (P4), runs criteria/search, returns all UI updates.
 */
export async function submitBuyerChatMessage(
  message: string,
  onUpdate: (update: BuyerChatUpdate) => void,
  options?: BuyerChatFlowOptions,
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

  if (!activeSessionId && !isSkip && !options?.language) {
    activeLanguage = detectBuyerLanguage(trimmed);
  }

  const at = new Date().toISOString();

  try {
    if (/תודיע|התר(?:אה|עה)|עדכ(?:ן|ני).*למכירה|notify me|alert me/i.test(trimmed)) {
      if (!latestResultLots.length) {
        onUpdate({ speaker: 'system', text: activeLanguage === 'he' ? 'חפשי או בחרי פריט לפני יצירת התראת הדגמה.' : 'Search for or select an item before creating a demo alert.' });
        return;
      }
      const key = 'monabid-buyer-demo-alerts';
      const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      const alerts = Array.isArray(saved) ? saved : [];
      const alert = { createdAt: at, sessionId: activeSessionId, selectedLot: activeContext.selectedLot,
        categories: [...new Set(latestResultLots.map(lot => lot.category))], request: trimmed };
      localStorage.setItem(key, JSON.stringify([...alerts, alert]));
      onUpdate({ speaker: 'system', text: activeLanguage === 'he'
        ? 'התראת הדגמה נשמרה בדפדפן הזה. אין מעקב אמיתי אחר מכירות ואין שליחת הודעות.'
        : 'Demo alert saved in this browser. It does not monitor auctions or send notifications.' });
      return;
    }
    const ordinal = /(?:הפריט|פריט)\s+(?:ה)?(ראשון|שני|שלישי|רביעי)|(?:the\s+)?(first|second|third|fourth)\s+(?:item|lot)/i.exec(trimmed);
    if (ordinal) {
      const index = ['ראשון', 'שני', 'שלישי', 'רביעי'].indexOf(ordinal[1] ?? '');
      const englishIndex = ['first', 'second', 'third', 'fourth'].indexOf(ordinal[2]?.toLowerCase() ?? '');
      const lot = latestResultLots[index >= 0 ? index : englishIndex];
      if (!lot) {
        onUpdate({ speaker: 'system', text: activeLanguage === 'he' ? 'הפריט המבוקש אינו ברשימת התוצאות. בחרי פריט קיים.' : 'That item is not in the results. Select an available item.' });
        return;
      }
      selectBuyerLot(lot);
    }
    const requestInit: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: trimmed,
        sessionId: activeSessionId ?? undefined,
        language: activeLanguage,
        context: toP4AiContext(activeContext, activeSessionId ?? undefined),
        messageId: activeSessionId ? `buyer-${at}` : undefined,
      }),
    };
    let response = await fetch(`${buyerApiBaseUrl}/buyer/conversation/message/stream`, requestInit);
    if (!response.ok) throw new BuyerApiError(response.status);

    if (!response.headers.get('content-type')?.includes('text/event-stream')) {
      throw new Error('Buyer conversation endpoint did not return a stream.');
    }
    const streamed = await readConversationMessageStream(
      response,
      onUpdate,
      (sessionId) => options?.onSessionId?.(sessionId),
    );
    const { response: body, streamedUpdateIndexes } = streamed;

    const sessionIdWasStreamed = activeSessionId === body.sessionId;
    activeSessionId = body.sessionId;
    const p4 = body.turn?.p4 as { intentRoute?: { functionName?: string; arguments?: { category?: string } } } | undefined;
    if (p4?.intentRoute?.functionName === 'rankSellerHouses') houseCategory = p4.intentRoute.arguments?.category;
    // Keep only B3's latest result set. A later price-trend request sends these
    // IDs back to B2; B4 uses them as evidence and never chooses similarity.
    const resultLots = body.updates.flatMap((update) =>
      update.speaker === 'result-group' ? [...update.lots.map((lot) => ({ id: lot.id })), ...(update.evidenceLotIds ?? []).map(id => ({ id }))] : [],
    );
    if (resultLots.length > 0 && p4?.intentRoute?.functionName !== 'getLotById') {
      latestResultLots = body.updates.flatMap(update => update.speaker === 'result-group' ? update.lots : []);
      activeContext = { ...activeContext, lots: resultLots };
    }
    if (!sessionIdWasStreamed) options?.onSessionId?.(body.sessionId);
    options?.onTurnLog?.(body.turn);
    body.updates.forEach((update, index) => {
      if (!streamedUpdateIndexes.has(index)) onUpdate(update);
    });
  } catch (error) {
    const unavailable = error instanceof BuyerApiError && [429, 503].includes(error.status);
    const text = unavailable
      ? activeLanguage === 'he'
        ? '\u05e9\u05d9\u05e8\u05d5\u05ea \u05d4\u05beAI \u05dc\u05d0 \u05d6\u05de\u05d9\u05df \u05db\u05e8\u05d2\u05e2. \u05e0\u05e1\u05d9 \u05e9\u05d5\u05d1 \u05de\u05d0\u05d5\u05d7\u05e8 \u05d9\u05d5\u05ea\u05e8.'
        : 'The AI service is currently unavailable. Please try again later.'
      : activeLanguage === 'he'
        ? '\u05dc\u05d0 \u05d4\u05e6\u05dc\u05d7\u05e0\u05d5 \u05dc\u05e9\u05dc\u05d5\u05d7 \u05d0\u05ea \u05d4\u05d4\u05d5\u05d3\u05e2\u05d4. \u05e0\u05e1\u05d9 \u05e9\u05d5\u05d1.'
        : 'We could not send your message. Please try again.';
    onUpdate({ speaker: 'error', code: 'buyer_chat_flow_failed', text });
  }
}

/** Test helper — reset module session between tests. */
export function resetBuyerChatFlowForTests(): void {
  activeSessionId = null;
  activeLanguage = 'en';
  activeContext = {};
  latestResultLots = [];
  houseCategory = undefined;
}
