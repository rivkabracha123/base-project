import { randomUUID } from 'node:crypto';
import type { BuyerCriteriaHistoryEntry, BuyerCriteriaHistoryInput } from './buyer-chat-api';
import type { BuyerCriteria, BuyerCriteriaConversation, BuyerCriteriaResponse } from './buyer-criteria';

type BuyerCriteriaSessionRecord = {
  criteria: BuyerCriteria;
  conversation: BuyerCriteriaConversation;
  history: BuyerCriteriaHistoryEntry[];
};

const sessions = new Map<string, BuyerCriteriaSessionRecord>();

/** Listener — append one chat line for DB/history; caller supplies id. */
export function appendBuyerCriteriaHistory(
  sessionId: string,
  entry: BuyerCriteriaHistoryInput,
): BuyerCriteriaHistoryEntry {
  const existing = sessions.get(sessionId);
  if (!existing) {
    throw new Error(`Unknown buyer criteria session: ${sessionId}`);
  }

  const saved: BuyerCriteriaHistoryEntry = entry;
  sessions.set(sessionId, {
    ...existing,
    history: [...existing.history, saved],
  });
  return saved;
}

export function createBuyerCriteriaSession(
  response: BuyerCriteriaResponse,
  date: string,
): { sessionId: string; systemMessage: BuyerCriteriaHistoryEntry & { speaker: 'system' } } {
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
    date,
  }) as BuyerCriteriaHistoryEntry & { speaker: 'system' };
  return { sessionId, systemMessage };
}

export function getBuyerCriteriaSession(sessionId: string): BuyerCriteriaSessionRecord | undefined {
  return sessions.get(sessionId);
}

export function saveBuyerCriteriaSessionTurn(
  sessionId: string,
  response: BuyerCriteriaResponse,
  date: string,
): (BuyerCriteriaHistoryEntry & { speaker: 'system' }) | undefined {
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
    date,
  }) as BuyerCriteriaHistoryEntry & { speaker: 'system' };
}

export function resetBuyerCriteriaSessions(): void {
  sessions.clear();
}
