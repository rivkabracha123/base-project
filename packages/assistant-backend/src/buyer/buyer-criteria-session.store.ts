import { randomUUID } from 'node:crypto';
import type { BuyerChatHistoryEntry, BuyerChatHistoryInput } from './buyer-chat-messages';
import type { BuyerCriteria, BuyerCriteriaConversation, BuyerCriteriaResponse } from './buyer-criteria';

type BuyerCriteriaSessionRecord = {
  criteria: BuyerCriteria;
  conversation: BuyerCriteriaConversation;
  history: BuyerChatHistoryEntry[];
};

const sessions = new Map<string, BuyerCriteriaSessionRecord>();

export function appendBuyerCriteriaHistory(
  sessionId: string,
  entry: BuyerChatHistoryInput,
): BuyerChatHistoryEntry {
  const existing = sessions.get(sessionId);
  if (!existing) {
    throw new Error(`Unknown buyer criteria session: ${sessionId}`);
  }

  const saved: BuyerChatHistoryEntry = entry;
  sessions.set(sessionId, {
    ...existing,
    history: [...existing.history, saved],
  });
  return saved;
}

export function createBuyerCriteriaSession(
  response: BuyerCriteriaResponse,
): { sessionId: string; systemMessage: BuyerChatHistoryEntry & { speaker: 'system' } } {
  const sessionId = randomUUID();
  sessions.set(sessionId, {
    criteria: response.criteria,
    conversation: response.conversation,
    history: [],
  });
  const systemMessage = appendBuyerCriteriaHistory(sessionId, {
    id: randomUUID(),
    speaker: 'system',
    text: response.conversation.nextQuestion,
  }) as BuyerChatHistoryEntry & { speaker: 'system' };
  return { sessionId, systemMessage };
}

export function getBuyerCriteriaSession(sessionId: string): BuyerCriteriaSessionRecord | undefined {
  return sessions.get(sessionId);
}

export function saveSessionAfterClarification(
  sessionId: string,
  response: BuyerCriteriaResponse,
): (BuyerChatHistoryEntry & { speaker: 'system' }) | undefined {
  const existing = sessions.get(sessionId);
  if (!existing) {
    throw new Error(`Unknown buyer criteria session: ${sessionId}`);
  }

  sessions.set(sessionId, {
    criteria: response.criteria,
    conversation: response.conversation,
    history: existing.history,
  });

  if (response.conversation.nextQuestion.trim().length === 0) {
    return undefined;
  }

  return appendBuyerCriteriaHistory(sessionId, {
    id: randomUUID(),
    speaker: 'system',
    text: response.conversation.nextQuestion,
  }) as BuyerChatHistoryEntry & { speaker: 'system' };
}

export function getBuyerCriteriaSessionSnapshot(sessionId: string): BuyerCriteriaSessionRecord {
  const existing = sessions.get(sessionId);
  if (!existing) {
    throw new Error(`Unknown buyer criteria session: ${sessionId}`);
  }
  return {
    criteria: existing.criteria,
    conversation: existing.conversation,
    history: [...existing.history],
  };
}

export function resetBuyerCriteriaSessions(): void {
  sessions.clear();
}

export type { BuyerCriteriaSessionRecord };
