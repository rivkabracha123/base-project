import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { buildMissingFields, detectBuyerLanguage, OPTIONAL_SEARCH_FACTS } from './buyer-criteria';
import type { BuyerChatUpdate } from './buyer-chat-update';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerP4BridgeService } from './buyer-p4-bridge.service';
import { BuyerP4FunctionExecutor } from './buyer-p4-function.executor';
import type { P4AiGenerateResponse } from '../ai/p4-ai.types';
import { buildFixtureAiExtract } from '../ai/fixture-ai-extract';

import {
  BUYER_CHAT_SKIP,
  type BuyerConversationMessageRequest,
  type BuyerConversationMessageResponse,
} from './buyer-conversation-message.dto';

function offTopicMessage(ai: P4AiGenerateResponse): string {
  const parts = [ai.extract.summary || ai.extract.content, ai.extract.nextAction].filter(Boolean);
  return [...new Set(parts)].join('\n');
}

@Injectable()
export class BuyerChatOrchestratorService {
  constructor(
    private readonly p4Bridge: BuyerP4BridgeService,
    private readonly criteriaService: BuyerCriteriaService,
    private readonly p4Functions: BuyerP4FunctionExecutor,
  ) {}

  async handleMessage(request: BuyerConversationMessageRequest): Promise<BuyerConversationMessageResponse> {
    const trimmed = request.message.trim();
    const currentSession = request.sessionId ? this.criteriaService.getSessionResponse(request.sessionId) : undefined;
    const currentField = currentSession ? buildMissingFields(currentSession.criteria, currentSession.conversation)[0] : undefined;
    const noBudget = !!request.sessionId && /^(?:לא|אין|אין תקציב|ללא תקציב|no|none|no budget|no preference)[.!?\s]*$/i.test(trimmed)
      && !!currentField && OPTIONAL_SEARCH_FACTS.includes(currentField);
    const isSkip = trimmed === BUYER_CHAT_SKIP || noBudget;
    const updates: BuyerChatUpdate[] = [];

    if (!isSkip && trimmed.length === 0) {
      throw new BadRequestException('Buyer message must not be empty.');
    }

    const at = new Date().toISOString();
    let sessionId = request.sessionId;
    let language = request.language ?? 'en';
    let lastAi: P4AiGenerateResponse | undefined;

    const p4Context = {
      ...request.context,
      sessionId: sessionId ?? request.context?.sessionId,
    };

    if (!sessionId) {
      if (isSkip) {
        throw new BadRequestException('Cannot skip before the first buyer message.');
      }

      language = request.language ?? detectBuyerLanguage(trimmed);

      const opened = await this.p4Bridge.openConversation({
        message: trimmed,
        language,
        context: request.context,
      });

      sessionId = opened.chat.sessionId;
      lastAi = opened.ai;
      p4Context.sessionId = sessionId;
      const directAction = opened.ai.intentRoute?.functionName === 'rankSellerHouses' || opened.ai.intentRoute?.intent === 'search_similar_lots';
      if (!directAction || !opened.ai.intentRoute.readyForFunction) {
        if (opened.ai.extract.isRelevant === false || buildMissingFields(this.criteriaService.getSessionResponse(sessionId).criteria,
          this.criteriaService.getSessionResponse(sessionId).conversation).length > 0) {
          updates.push({ speaker: 'system', text: opened.ai.extract.isRelevant === false
            ? offTopicMessage(opened.ai) : opened.chat.text });
        }
      }
    } else {
      if (!isSkip) {
        const session = this.criteriaService.getSessionResponse(sessionId);
        language = session.criteria.language;
        lastAi = await this.p4Bridge.routeBuyerMessage(trimmed, language, {
          ...request.context,
          sessionId,
        });
      }
      if (lastAi?.extract.isRelevant === false) {
        updates.push({ speaker: 'system', text: offTopicMessage(lastAi) });
      } else if (lastAi?.intentRoute.functionName === 'rankSellerHouses') {
        if (!lastAi.readyForFunction) {
          updates.push({ speaker: 'system', text: language === 'he'
            ? 'באיזו קטגוריה לחפש בית מכירות מתמחה?'
            : 'Which category should the auction house specialize in?' });
        }
      } else if (lastAi?.intentRoute.intent === 'search_similar_lots') {
        if (!lastAi.intentRoute.readyForFunction) {
          updates.push({ speaker: 'system', text: language === 'he'
            ? '\u05d1\u05d7\u05e8\u05d9 \u05e4\u05e8\u05d9\u05d8 \u05d0\u05d5 \u05e6\u05d9\u05d9\u05e0\u05d9 \u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d4 \u05dc\u05d7\u05d9\u05e4\u05d5\u05e9 \u05e4\u05e8\u05d9\u05d8\u05d9\u05dd \u05d3\u05d5\u05de\u05d9\u05dd.'
            : 'Select an item or specify a category to find similar items.' });
        }
      } else if (lastAi?.intentRoute.functionName && lastAi.intentRoute.functionName !== 'searchLots') {
        // Explicit actions are handled below without feeding their text into criteria collection.
      } else {
        const turnId = request.messageId?.trim() || randomUUID();
        const reply = this.criteriaService.continueCriteriaSessionFromChat(
          isSkip
            ? {
                id: turnId,
                sessionId,
                speaker: 'buyer',
                skipped: true,
              }
            : {
                id: turnId,
                sessionId,
                speaker: 'buyer',
                skipped: false,
                text: trimmed,
              },
        );
        const updatedSession = this.criteriaService.getSessionResponse(sessionId);
        if (buildMissingFields(updatedSession.criteria, updatedSession.conversation).length > 0) {
          updates.push({ speaker: 'system', text: reply.text });
        }
      }
    }

    await this.runP4Functions(sessionId, language, p4Context, lastAi, updates);

    return {
      sessionId,
      updates,
      turn: {
        at,
        buyer: {
          message: trimmed,
          skipped: isSkip,
          messageId: request.messageId,
          language: request.language,
          context: request.context,
        },
        ...(lastAi ? { p4: lastAi } : {}),
        /** What Tamar may render — criteria + function results only (no Shilat prose on screen). */
        updates: [...updates],
      },
    };
  }

  private async runP4Functions(
    sessionId: string,
    language: 'he' | 'en',
    p4Context: BuyerConversationMessageRequest['context'],
    ai: P4AiGenerateResponse | undefined,
    updates: BuyerChatUpdate[],
  ): Promise<void> {
    if (ai?.extract.isRelevant === false) {
      return;
    }

    const session = this.criteriaService.getSessionResponse(sessionId);
    const missing = buildMissingFields(session.criteria, session.conversation);
    const criteriaComplete = missing.length === 0;

    if (!ai) {
      if (!criteriaComplete) return;
      const readiness = await this.p4Bridge.evaluateSearchReadiness(sessionId, p4Context);
      await this.p4Functions.execute({
        extract: buildFixtureAiExtract('', language),
        readyForFunction: readiness.readyForFunction,
        intentRoute: readiness,
        functionParameters: readiness.arguments ?? null,
      }, { sessionId, language, p4Context, criteriaComplete: true }, updates);
      return;
    }

    const handled = await this.p4Functions.execute(
      ai,
      { sessionId, language, p4Context, criteriaComplete },
      updates,
    );

    if (handled || (ai.intentRoute.functionName && ai.intentRoute.functionName !== 'searchLots') || ai.intentRoute.intent === 'search_similar_lots') {
      return;
    }

    if (!criteriaComplete) {
      return;
    }

    const readiness = await this.p4Bridge.evaluateSearchReadiness(sessionId, p4Context);
    const readinessAi: P4AiGenerateResponse = {
      extract: ai.extract,
      readyForFunction: readiness.readyForFunction,
      intentRoute: readiness,
      functionParameters: ai.functionParameters,
    };

    await this.p4Functions.execute(
      readinessAi,
      { sessionId, language, p4Context, criteriaComplete: true },
      updates,
    );
  }
}
