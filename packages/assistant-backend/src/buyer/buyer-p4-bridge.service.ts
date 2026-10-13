import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { buildFixtureAiExtract } from '../ai/fixture-ai-extract';
import { P4AiGenerateClient } from '../ai/p4-ai-generate.client';
import { toSearchReadinessRoute } from '../ai/p4-buyer-routing';
import { routeBuyerIntent } from '../ai/intent-router';
import {
  P4_SEARCH_READINESS_PROBE_MESSAGE,
  mergeBuyerContextIntoShilatRequest,
  type P4AiGenerateResponse,
  type P4BuyerAiContext,
  type P4IntentRoute,
  type ShilatAiGenerateRequest,
} from '../ai/p4-ai.types';
import { BuyerChatSystemMessage } from './buyer-chat-messages';
import { buildMissingFields, detectBuyerLanguage, parseCriteriaFromAiResponse } from './buyer-criteria';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { getBuyerCriteriaSession } from './buyer-criteria-session.store';
import type { OpenBuyerConversationRequest } from './buyer-conversation.dto';
import { sellerComparisonCategory } from '../seller-intake/seller-item-readiness';

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

    const ai = await this.generateWithGuidedFallback(
      mergeBuyerContextIntoShilatRequest(request.message.trim(), language, request.context),
    );

    if (ai.extract.structuredAnswer?.category) {
      ai.extract.structuredAnswer.category = sellerComparisonCategory(ai.extract.structuredAnswer.category, request.message);
    }
    this.routeHouseRanking(request.message, language, ai, undefined, request.context);
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

    const ai = await this.generateWithGuidedFallback(
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
    const ai = await this.generateWithGuidedFallback(
      mergeBuyerContextIntoShilatRequest(prompt.trim(), language, context),
    );
    this.routeHouseRanking(prompt, language, ai, context?.sessionId, context);
    return ai;
  }

  private async generateWithGuidedFallback(request: ShilatAiGenerateRequest): Promise<P4AiGenerateResponse> {
    try {
      return await this.p4.generateBuyerExtract(request);
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      // Only provider availability failures use local parsing; saved criteria stay authoritative.
      const extract = buildFixtureAiExtract(request.prompt, request.language);
      extract.confidence = 'low';
      extract.error = 'guided_fallback';
      const session = request.sessionId ? getBuyerCriteriaSession(request.sessionId) : undefined;
      const ready = !!session && buildMissingFields(session.criteria, session.conversation).length === 0;
      const probe = request.prompt.startsWith(P4_SEARCH_READINESS_PROBE_MESSAGE);
      const route = probe
        ? { functionName: ready ? 'searchLots' : null, readyForFunction: ready }
        : routeBuyerIntent(request.prompt, {
            language: request.language, selectedLot: request.selectedLot ?? undefined,
            lots: request.lots,
            category: session?.criteria.categories.map(category => category.trim()).filter(Boolean).at(-1),
          });
      return { extract, readyForFunction: route.readyForFunction, intentRoute: route,
        functionParameters: 'arguments' in route ? route.arguments ?? null : null };
    }
  }

  private routeHouseRanking(prompt: string, language: 'he' | 'en', ai: P4AiGenerateResponse, sessionId?: string, context?: P4BuyerAiContext): void {
    const session = sessionId ? getBuyerCriteriaSession(sessionId) : undefined;
    const extraction = ai.extract.structuredAnswer;
    const explicitCategory = parseCriteriaFromAiResponse(buildFixtureAiExtract(prompt, language)).criteria.categories.at(-1);
    const route = routeBuyerIntent(prompt, {
      language,
      selectedLot: context?.selectedLot ?? undefined,
      lots: context?.lots,
      category: explicitCategory ? sellerComparisonCategory(explicitCategory, prompt)
        : session?.criteria.categories.map((category) => category.trim()).filter(Boolean).at(-1) || extraction?.category,
      geography: session?.criteria.geography.join(', ') || extraction?.geography?.join(', '),
    });
    if (!['buyer_house_ranking', 'search_similar_lots', 'same_item_sale_history', 'price_trend', 'get_lot_details'].includes(route.intent)) return;
    if (explicitCategory && route.intent === 'search_similar_lots') {
      route.arguments.category = sellerComparisonCategory(explicitCategory, prompt);
    }
    // Auction-house expertise is a supported buyer request even if the model
    // classifies it outside item search.
    ai.extract.isRelevant = true;
    ai.intentRoute = route;
    ai.readyForFunction = route.readyForFunction;
    ai.functionParameters = route.arguments;
  }
}
