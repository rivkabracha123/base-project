import { Injectable, NotFoundException } from '@nestjs/common';
import { P4AiGenerateClient } from '../ai/p4-ai-generate.client';
import { toSearchReadinessRoute } from '../ai/p4-buyer-routing';
import { routeBuyerIntent } from '../ai/intent-router';
import {
  P4_SEARCH_READINESS_PROBE_MESSAGE,
  mergeBuyerContextIntoShilatRequest,
  type P4AiGenerateResponse,
  type P4BuyerAiContext,
  type P4IntentRoute,
} from '../ai/p4-ai.types';
import { BuyerChatSystemMessage } from './buyer-chat-messages';
import { buildMissingFields, detectBuyerLanguage } from './buyer-criteria';
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
    const language = request.language ?? detectBuyerLanguage(request.message);

    const ai = await this.p4.generateBuyerExtract(
      mergeBuyerContextIntoShilatRequest(request.message.trim(), language, request.context),
    );

    this.routeHouseRanking(request.message, language, ai);
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

    const ai = await this.p4.generateBuyerExtract(
      mergeBuyerContextIntoShilatRequest(`${P4_SEARCH_READINESS_PROBE_MESSAGE}\n${JSON.stringify({
        criteria: session.criteria,
        skippedFields: session.conversation.skipped,
      })}`, session.criteria.language, {
        ...context,
        sessionId,
      }),
    );

    return toSearchReadinessRoute(ai);
  }

  /** P4 on any buyer turn — routing only; B2 executes via BuyerP4FunctionExecutor. */
  async routeBuyerMessage(
    prompt: string,
    language: 'he' | 'en',
    context?: P4BuyerAiContext,
  ): Promise<P4AiGenerateResponse> {
    const ai = await this.p4.generateBuyerExtract(
      mergeBuyerContextIntoShilatRequest(prompt.trim(), language, context),
    );
    this.routeHouseRanking(prompt, language, ai, context?.sessionId);
    return ai;
  }

  private routeHouseRanking(prompt: string, language: 'he' | 'en', ai: P4AiGenerateResponse, sessionId?: string): void {
    const session = sessionId ? getBuyerCriteriaSession(sessionId) : undefined;
    const extraction = ai.extract.structuredAnswer;
    const route = routeBuyerIntent(prompt, {
      language,
      category: session?.criteria.categories[0] || extraction?.category,
      geography: session?.criteria.geography.join(', ') || extraction?.geography?.join(', '),
    });
    if (route.intent !== 'buyer_house_ranking') return;
    // Auction-house expertise is a supported buyer request even if the model
    // classifies it outside item search.
    ai.extract.isRelevant = true;
    ai.intentRoute = route;
    ai.readyForFunction = route.readyForFunction;
    ai.functionParameters = route.arguments;
  }
}
