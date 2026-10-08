import type { AuctionLot } from '@monabid/shared';
import { fetchBuyerJson } from './buyer-api';
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

let activeSessionId: string | null = null;
let activeLanguage: 'he' | 'en' = 'en';
let activeContext: BuyerChatFlowContext = {};

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
}): void {
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
    const body = await fetchBuyerJson<ConversationMessageResponse>('/buyer/conversation/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: trimmed,
        sessionId: activeSessionId ?? undefined,
        language: activeLanguage,
        context: toP4AiContext(activeContext, activeSessionId ?? undefined),
        messageId: activeSessionId ? `buyer-${at}` : undefined,
      }),
    });

    activeSessionId = body.sessionId;
    options?.onSessionId?.(body.sessionId);
    options?.onTurnLog?.(body.turn);
    for (const update of body.updates) {
      onUpdate(update);
    }
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Unknown error';
    onUpdate({ speaker: 'error', code: 'buyer_chat_flow_failed', text });
    throw error;
  }
}

/** Test helper — reset module session between tests. */
export function resetBuyerChatFlowForTests(): void {
  activeSessionId = null;
  activeLanguage = 'en';
  activeContext = {};
}
