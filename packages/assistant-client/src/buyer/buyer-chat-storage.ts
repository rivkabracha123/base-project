import { z } from 'zod';
import { buyerMessageSchema, type BuyerMessage } from './messages';
import type { BuyerChatFlowContext } from './buyer-chat-flow';

const contextSchema = z.object({
  selectedLot: z
    .object({
      id: z.string().min(1),
      itemKey: z.string().min(1).optional(),
    })
    .nullable()
    .optional(),
  lots: z.array(z.object({ id: z.string().min(1) })).optional(),
});

/** Full server turn (buyer + p4 + updates) — stored as JSON for audit/debug. */
export type BuyerChatTurnLog = Record<string, unknown>;

const persistedStateSchemaV2 = z.object({
  version: z.literal(2),
  messages: z.array(buyerMessageSchema),
  sessionId: z.string().min(1).optional(),
  context: contextSchema.optional(),
  turns: z.array(z.record(z.string(), z.unknown())).optional(),
});

const persistedStateSchemaV1 = z.object({
  version: z.literal(1),
  messages: z.array(buyerMessageSchema),
  sessionId: z.string().min(1).optional(),
  context: contextSchema.optional(),
});

export type BuyerChatPersistedState = {
  messages: BuyerMessage[];
  sessionId?: string;
  context?: BuyerChatFlowContext;
  turns?: BuyerChatTurnLog[];
};

const storageKey = (language: 'he' | 'en') => `monabid.buyer-chat.${language}`;

function parseMessages(raw: unknown): BuyerMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const result = buyerMessageSchema.safeParse(entry);
    return result.success ? [result.data] : [];
  });
}

export function loadStoredBuyerChatState(language: 'he' | 'en'): BuyerChatPersistedState {
  try {
    const raw = localStorage.getItem(storageKey(language));
    if (!raw) return { messages: [], turns: [] };

    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { messages: parseMessages(parsed), turns: [] };
    }

    const v2 = persistedStateSchemaV2.safeParse(parsed);
    if (v2.success) {
      return {
        messages: v2.data.messages,
        sessionId: v2.data.sessionId,
        context: v2.data.context,
        turns: v2.data.turns ?? [],
      };
    }

    const v1 = persistedStateSchemaV1.safeParse(parsed);
    if (v1.success) {
      return {
        messages: v1.data.messages,
        sessionId: v1.data.sessionId,
        context: v1.data.context,
        turns: [],
      };
    }

    return { messages: [], turns: [] };
  } catch {
    return { messages: [], turns: [] };
  }
}

export function saveStoredBuyerChatState(language: 'he' | 'en', state: BuyerChatPersistedState): void {
  const payload = {
    version: 2 as const,
    messages: state.messages,
    turns: state.turns ?? [],
    ...(state.sessionId ? { sessionId: state.sessionId } : {}),
    ...(state.context ? { context: state.context } : {}),
  };
  localStorage.setItem(storageKey(language), JSON.stringify(payload));
}

export function appendStoredBuyerChatTurn(language: 'he' | 'en', turn: BuyerChatTurnLog): void {
  const state = loadStoredBuyerChatState(language);
  saveStoredBuyerChatState(language, {
    ...state,
    turns: [...(state.turns ?? []), turn],
  });
}

/** @deprecated use loadStoredBuyerChatState */
export function loadStoredBuyerChatMessages(language: 'he' | 'en'): BuyerMessage[] {
  return loadStoredBuyerChatState(language).messages;
}

/** @deprecated use saveStoredBuyerChatState */
export function saveStoredBuyerChatMessages(language: 'he' | 'en', messages: BuyerMessage[]): void {
  const existing = loadStoredBuyerChatState(language);
  saveStoredBuyerChatState(language, { ...existing, messages });
}

export function clearStoredBuyerChatState(language: 'he' | 'en'): void {
  localStorage.removeItem(storageKey(language));
}
