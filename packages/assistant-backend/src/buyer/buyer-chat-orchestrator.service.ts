import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { buildMissingFields, detectBuyerLanguage } from './buyer-criteria';
import type { BuyerChatUpdate } from './buyer-chat-update';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerP4BridgeService } from './buyer-p4-bridge.service';
import { BuyerP4FunctionExecutor } from './buyer-p4-function.executor';
import type { P4AiGenerateResponse } from '../ai/p4-ai.types';
import {
  BUYER_CHAT_SKIP,
  type BuyerConversationMessageRequest,
  type BuyerConversationMessageResponse,
} from './buyer-conversation-message.dto';

@Injectable()
export class BuyerChatOrchestratorService {
  constructor(
    private readonly p4Bridge: BuyerP4BridgeService,
    private readonly criteriaService: BuyerCriteriaService,
    private readonly p4Functions: BuyerP4FunctionExecutor,
  ) {}

  async handleMessage(request: BuyerConversationMessageRequest): Promise<BuyerConversationMessageResponse> {
    const trimmed = request.message.trim();
    const isSkip = trimmed === BUYER_CHAT_SKIP;
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
      updates.push({ speaker: 'system', text: opened.chat.text });
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
      updates.push({ speaker: 'system', text: reply.text });

      if (!isSkip) {
        const session = this.criteriaService.getSessionResponse(sessionId);
        language = session.criteria.language;
        lastAi = await this.p4Bridge.routeBuyerMessage(trimmed, language, {
          ...request.context,
          sessionId,
        });
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
    if (!ai) {
      return;
    }

    const session = this.criteriaService.getSessionResponse(sessionId);
    const missing = buildMissingFields(session.criteria, session.conversation);
    const criteriaComplete = missing.length === 0;

    const handled = await this.p4Functions.execute(
      ai,
      { sessionId, language, p4Context, criteriaComplete },
      updates,
    );

    if (handled) {
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
