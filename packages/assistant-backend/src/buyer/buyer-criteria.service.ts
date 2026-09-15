import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { BuyerCriteria } from './buyer-criteria';
import {
  BuyerCriteriaB1Response,
  BuyerCriteriaHistoryEntry,
  BuyerCriteriaTurnRequest,
  toBuyerCriteriaB1Response,
} from './buyer-chat-api';
import {
  BuyerCriteriaResponse,
  P4FixtureResponse,
  extractBuyerCriteriaFromFixture,
  processCriteriaTurn,
} from './buyer-criteria';
import {
  appendBuyerCriteriaHistory,
  createBuyerCriteriaSession,
  getBuyerCriteriaSession,
  resetBuyerCriteriaSessions,
  saveBuyerCriteriaSessionTurn,
} from './buyer-criteria-session.store';

export { appendBuyerCriteriaHistory };

function toHistoryEntry(request: BuyerCriteriaTurnRequest): BuyerCriteriaHistoryEntry {
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
  extractFromFixture(response: P4FixtureResponse): BuyerCriteriaB1Response {
    const extracted = extractBuyerCriteriaFromFixture(response);
    const date = new Date().toISOString();
    const { sessionId, systemMessage } = createBuyerCriteriaSession(extracted, date);
    return toBuyerCriteriaB1Response(sessionId, systemMessage);
  }

  processTurn(request: BuyerCriteriaTurnRequest): BuyerCriteriaB1Response {
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

    const updated = processCriteriaTurn({
      criteria: session.criteria,
      conversation: session.conversation,
      action: request.skipped ? 'skip' : 'answer',
      message: request.skipped ? undefined : request.text.trim(),
    });

    const date = new Date().toISOString();
    const systemMessage = saveBuyerCriteriaSessionTurn(request.sessionId, updated, date);
    if (systemMessage) {
      return toBuyerCriteriaB1Response(request.sessionId, systemMessage);
    }

    return toBuyerCriteriaB1Response(request.sessionId, {
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

  getHistory(sessionId: string): BuyerCriteriaHistoryEntry[] {
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
