import { Injectable, NotFoundException } from '@nestjs/common';
import { P4AiGenerateClient } from '../ai/p4-ai-generate.client';
import type { P4AiGenerateResponse, P4BuyerAiContext, P4IntentRoute } from '../ai/p4-ai.types';
import { P4_BUYER_FUNCTION_ROUTES } from '../ai/p4-ai.types';
import { BuyerChatSystemMessage } from './buyer-chat-messages';
import { buildMissingFields } from './buyer-criteria';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { getBuyerCriteriaSession } from './buyer-criteria-session.store';
import type { OpenBuyerConversationRequest } from './buyer-conversation.dto';

export type OpenBuyerConversationResponse = {
  chat: BuyerChatSystemMessage;
  ai: P4AiGenerateResponse;
};

@Injectable()
export class BuyerP4BridgeService {
  constructor(
    private readonly p4: P4AiGenerateClient,
    private readonly criteriaService: BuyerCriteriaService,
  ) {}

  async openConversation(request: OpenBuyerConversationRequest): Promise<OpenBuyerConversationResponse> {
    const language =
      request.language ??
      (/[\u0590-\u05FF]/.test(request.message) ? 'he' : 'en');

    const ai = await this.p4.generateBuyerExtract({
      role: 'buyer',
      userMessage: request.message.trim(),
      language,
      context: request.context,
    });

    const chat = this.criteriaService.startCriteriaSessionFromAiResponse(ai.extract);

    return { chat, ai };
  }

  /** Ask P4 (Shilat) whether search/similar is allowed — B2 never searches when false. */
  async evaluateSearchReadiness(sessionId: string, context?: P4BuyerAiContext): Promise<P4IntentRoute> {
    const session = getBuyerCriteriaSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Unknown buyer criteria session: ${sessionId}`);
    }

    const missing = buildMissingFields(session.criteria, session.conversation);
    if (missing.length > 0) {
      return { functionName: null, readyForFunction: false };
    }

    const ai = await this.p4.generateBuyerExtract({
      role: 'buyer',
      userMessage: 'Buyer criteria are complete. Evaluate readiness for search.',
      language: session.criteria.language,
      context: {
        ...context,
        sessionId,
      },
    });

    if (!ai.readyForFunction) {
      return { functionName: null, readyForFunction: false };
    }

    const functionName =
      ai.intentRoute.functionName ?? P4_BUYER_FUNCTION_ROUTES.searchLots.functionName;

    if (functionName === P4_BUYER_FUNCTION_ROUTES.searchLots.functionName) {
      return { functionName, readyForFunction: true };
    }

    return { functionName, readyForFunction: true };
  }
}
