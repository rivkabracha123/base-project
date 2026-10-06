import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { BuyerCriteria } from './buyer-criteria';
import {
  BuyerChatSystemMessage,
  BuyerChatHistoryEntry,
  BuyerChatTurnInput,
  buildChatSystemMessage,
} from './buyer-chat-messages';
import {
  BuyerCriteriaResponse,
  AiExtractResponse,
  parseCriteriaFromAiResponse,
  applyClarificationTurn,
} from './buyer-criteria';
import {
  appendBuyerCriteriaHistory,
  createBuyerCriteriaSession,
  getBuyerCriteriaSession,
  resetBuyerCriteriaSessions,
  saveSessionAfterClarification,
} from './buyer-criteria-session.store';

export { appendBuyerCriteriaHistory };

function toHistoryEntry(request: BuyerChatTurnInput): BuyerChatHistoryEntry {
  if (request.skipped) {
    return { id: request.id, speaker: 'buyer', skipped: true };
  }
  return {
    id: request.id,
    speaker: 'buyer',
    skipped: false,
    text: request.text.trim(),
  };
}

@Injectable()
export class BuyerCriteriaService {
  /** Create a criteria session from AI extract response and return the first system question for the chat UI. */
  startCriteriaSessionFromAiResponse(response: AiExtractResponse): BuyerChatSystemMessage {
    const extracted = parseCriteriaFromAiResponse(response);
    const { sessionId, systemMessage } = createBuyerCriteriaSession(extracted);
    return buildChatSystemMessage(sessionId, systemMessage);
  }

  /** Apply a buyer chat turn (answer or skip) and return the next system question for the chat UI. */
  continueCriteriaSessionFromChat(request: BuyerChatTurnInput): BuyerChatSystemMessage {
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

    const updated = applyClarificationTurn({
      criteria: session.criteria,
      conversation: session.conversation,
      action: request.skipped ? 'skip' : 'answer',
      message: request.skipped ? undefined : request.text.trim(),
    });

    const systemMessage = saveSessionAfterClarification(request.sessionId, updated);
    if (systemMessage) {
      return buildChatSystemMessage(request.sessionId, systemMessage);
    }

    return buildChatSystemMessage(request.sessionId, {
      id: randomUUID(),
      speaker: 'system',
      text: updated.conversation.nextQuestion,
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
