import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { BuyerCriteria } from './buyer-criteria';
import {
  BuyerChatSystemMessage,
  BuyerChatHistoryEntry,
  BuyerChatTurnInput,
  toBuyerChatSystemMessage,
} from './buyer-chat-api';
import {
  BuyerCriteriaResponse,
  AiExtractResponse,
  parseCriteriaFromAiResponse,
  applyCriteriaConversationTurn,
} from './buyer-criteria';
import {
  appendBuyerCriteriaHistory,
  createBuyerCriteriaSession,
  getBuyerCriteriaSession,
  resetBuyerCriteriaSessions,
  saveBuyerCriteriaSessionTurn,
} from './buyer-criteria-session.store';

export { appendBuyerCriteriaHistory };

function toHistoryEntry(request: BuyerChatTurnInput): BuyerChatHistoryEntry {
  if (request.skipped) {
    return { id: request.id, speaker: 'buyer', skipped: true, date: request.date };
  }
  return {
    id: request.id,
    speaker: 'buyer',
    skipped: false,
    text: request.text.trim(),
    date: request.date,
  };
}

@Injectable()
export class BuyerCriteriaService {
  /** Create a criteria session from AI extract response and return the first system question for Tamar. */
  startCriteriaSessionFromAiResponse(response: AiExtractResponse): BuyerChatSystemMessage {
    const extracted = parseCriteriaFromAiResponse(response);
    const date = new Date().toISOString();
    const { sessionId, systemMessage } = createBuyerCriteriaSession(extracted, date);
    return toBuyerChatSystemMessage(sessionId, systemMessage);
  }

  /** Apply a buyer chat turn (answer or skip) and return the next system question for Tamar. */
  continueCriteriaSessionFromChatTurn(request: BuyerChatTurnInput): BuyerChatSystemMessage {
    const session = getBuyerCriteriaSession(request.sessionId);
    if (!session) {
      throw new NotFoundException(`Unknown buyer criteria session: ${request.sessionId}`);
    }

    if (request.speaker !== 'buyer') {
      throw new BadRequestException('Turn request must come from the buyer.');
    }

    if (!request.id.trim()) {
      throw new BadRequestException('Turn request requires a non-empty message id.');
    }

    if (!request.skipped && !request.text.trim()) {
      throw new BadRequestException('Turn answer requires non-empty text.');
    }

    appendBuyerCriteriaHistory(request.sessionId, toHistoryEntry(request));

    const updated = applyCriteriaConversationTurn({
      criteria: session.criteria,
      conversation: session.conversation,
      action: request.skipped ? 'skip' : 'answer',
      message: request.skipped ? undefined : request.text.trim(),
    });

    const date = new Date().toISOString();
    const systemMessage = saveBuyerCriteriaSessionTurn(request.sessionId, updated, date);
    if (systemMessage) {
      return toBuyerChatSystemMessage(request.sessionId, systemMessage);
    }

    return toBuyerChatSystemMessage(request.sessionId, {
      id: randomUUID(),
      speaker: 'system',
      text: updated.conversation.nextQuestion,
      date,
    });
  }

  getCriteriaForSession(sessionId: string): BuyerCriteria {
    const session = getBuyerCriteriaSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Unknown buyer criteria session: ${sessionId}`);
    }
    return session.criteria;
  }

  getSessionResponse(sessionId: string): BuyerCriteriaResponse {
    const session = getBuyerCriteriaSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Unknown buyer criteria session: ${sessionId}`);
    }
    return {
      criteria: session.criteria,
      conversation: session.conversation,
    };
  }

  getHistory(sessionId: string): BuyerChatHistoryEntry[] {
    const session = getBuyerCriteriaSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Unknown buyer criteria session: ${sessionId}`);
    }
    return [...session.history];
  }

  resetSessionsForTests(): void {
    resetBuyerCriteriaSessions();
  }
}
