import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { buildMissingFields, detectBuyerLanguage, isBuyerCriteriaRefinement, OPTIONAL_SEARCH_FACTS } from './buyer-criteria';
import type { BuyerChatUpdate } from './buyer-chat-update';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerP4BridgeService } from './buyer-p4-bridge.service';
import { BuyerP4FunctionExecutor } from './buyer-p4-function.executor';
import type { P4AiGenerateResponse } from '../ai/p4-ai.types';
import { buildFixtureAiExtract } from '../ai/fixture-ai-extract';
import { SHILAT_MISSING_SIMILAR_FUNCTION } from '../ai/p4-buyer-routing';
import {
  appendBuyerConversationContext,
  getBuyerCriteriaSession,
  getBuyerConversationContext,
} from './buyer-criteria-session.store';

import {
  BUYER_CHAT_SKIP,
  type BuyerConversationMessageRequest,
  type BuyerConversationMessageResponse,
} from './buyer-conversation-message.dto';

export type BuyerConversationMessageCallbacks = {
  onSessionId?: (sessionId: string) => void;
  onUpdate?: (update: BuyerChatUpdate, index: number) => void;
};

class BuyerChatUpdateBuffer extends Array<BuyerChatUpdate> {
  static get [Symbol.species](): ArrayConstructor {
    return Array;
  }

  constructor(private readonly onUpdate?: BuyerConversationMessageCallbacks['onUpdate']) {
    super();
  }

  override push(...items: BuyerChatUpdate[]): number {
    const firstIndex = this.length;
    const length = super.push(...items);
    items.forEach((update, offset) => this.onUpdate?.(update, firstIndex + offset));
    return length;
  }
}

function offTopicMessage(ai: P4AiGenerateResponse): string {
  return compactVisibleAiText([
    ai.extract.summary || ai.extract.content,
    ai.generalInformation ? ai.extract.recommendation : undefined,
    ai.extract.nextAction,
  ]);
}

/** Drop overlapping lines and keep English to one sentence per field so replies stay short. */
function compactVisibleAiText(parts: Array<string | undefined | null>): string {
  const cleaned: string[] = [];
  for (const part of parts) {
    const text = tightenEnglish(String(part ?? '').trim());
    if (!text) continue;
    const key = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (cleaned.some((existing) => {
      const other = existing.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      return other.includes(key) || key.includes(other);
    })) continue;
    cleaned.push(text);
  }
  return [...new Set(cleaned)].join('\n');
}

function tightenEnglish(text: string): string {
  if (!text || /[\u0590-\u05FF]/.test(text) || !/[A-Za-z]/.test(text)) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [text];
  return sentences.slice(0, 1).join(' ').replace(/\s+/g, ' ').trim();
}

function sellerValuationMessage(language: 'he' | 'en'): string {
  return language === 'he'
    ? 'הערכת שווי מתבצעת בתהליך המוכר. עברי לצ׳אט המוכר, העלי או תארי את הפריט, ושם אוכל לבנות טיוטת פריט ולהציג הערכת שווי כשיש מספיק נתונים.'
    : 'Valuation is handled in the seller flow. Open the seller chat, upload or describe the item, and I can build the item draft and show a valuation when there is enough evidence.';
}

function isSellerValuationRequest(message: string): boolean {
  return /הערכת\s+שווי|להעריך\s+שווי|שווי\s+של\s+פריט|valuation|appraisal|value my item/i.test(message);
}

function isAffirmativeFollowUp(message: string): boolean {
  return /^(?:כן|כן בבקשה|נכון|בטח|בהחלט|אשמח|כן אשמח|yes|yeah|yep|sure|absolutely|please|go ahead|tell me more)[.!?\s]*$/i.test(message.trim());
}

function isQuestion(text: string | undefined): boolean {
  return !!text && /[?؟]\s*$/.test(text.trim());
}

function updateContextText(update: BuyerChatUpdate): string | undefined {
  if (update.speaker === 'system' || update.speaker === 'results-found' || update.speaker === 'no-results') return update.text;
  if (update.speaker === 'result-group') {
    const titles = update.lots.slice(0, 5).map((lot) => lot.title).filter(Boolean);
    return [update.title, ...titles].filter(Boolean).join(': ');
  }
  if (update.speaker === 'sale-history' || update.speaker === 'price-trend') {
    const titles = update.lots.slice(0, 5).map((lot) => lot.title).filter(Boolean);
    return [update.title, ...titles].filter(Boolean).join(': ');
  }
  if (update.speaker === 'house-ranking') return update.ranking.recommendation?.house.name
    ? `Recommended auction house: ${update.ranking.recommendation.house.name}`
    : 'Auction house recommendations were shown.';
  return undefined;
}

@Injectable()
export class BuyerChatOrchestratorService {
  constructor(
    private readonly p4Bridge: BuyerP4BridgeService,
    private readonly criteriaService: BuyerCriteriaService,
    private readonly p4Functions: BuyerP4FunctionExecutor,
  ) {}

  async handleMessage(
    request: BuyerConversationMessageRequest,
    callbacks: BuyerConversationMessageCallbacks = {},
  ): Promise<BuyerConversationMessageResponse> {
    const trimmed = request.message.trim();
    const currentSession = request.sessionId ? this.criteriaService.getSessionResponse(request.sessionId) : undefined;
    const currentField = currentSession ? buildMissingFields(currentSession.criteria, currentSession.conversation)[0] : undefined;
    const noBudget = !!request.sessionId && /^(?:לא|אין|אין תקציב|ללא תקציב|no|none|no budget|no preference)[.!?\s]*$/i.test(trimmed)
      && !!currentField && OPTIONAL_SEARCH_FACTS.includes(currentField);
    const isSkip = trimmed === BUYER_CHAT_SKIP || noBudget;
    const updates = new BuyerChatUpdateBuffer(callbacks.onUpdate);

    if (!isSkip && trimmed.length === 0) {
      throw new BadRequestException('Buyer message must not be empty.');
    }

    const at = new Date().toISOString();
    let sessionId = request.sessionId;
    if (sessionId) callbacks.onSessionId?.(sessionId);
    let language = request.language ?? 'en';
    let lastAi: P4AiGenerateResponse | undefined;

    if (!isSkip && isSellerValuationRequest(trimmed)) {
      if (sessionId) {
        const session = this.criteriaService.getSessionResponse(sessionId);
        language = session.criteria.language;
      } else {
        language = request.language ?? detectBuyerLanguage(trimmed);
        sessionId = this.criteriaService.startCriteriaSessionFromAiResponse(buildFixtureAiExtract('', language)).sessionId;
        callbacks.onSessionId?.(sessionId);
      }
      updates.push({ speaker: 'system', text: sellerValuationMessage(language) });
      if (getBuyerCriteriaSession(sessionId)) {
        appendBuyerConversationContext(sessionId, { speaker: 'buyer', text: trimmed });
        appendBuyerConversationContext(sessionId, { speaker: 'assistant', text: sellerValuationMessage(language) });
      }
      return {
        sessionId,
        updates,
        turn: {
          at,
          buyer: {
            message: trimmed,
            skipped: false,
            messageId: request.messageId,
            language: request.language,
            context: request.context,
          },
          updates: [...updates],
        },
      };
    }

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
      callbacks.onSessionId?.(sessionId);
      if (getBuyerCriteriaSession(sessionId)) {
        appendBuyerConversationContext(sessionId, { speaker: 'buyer', text: trimmed });
      }
      lastAi = opened.ai;
      p4Context.sessionId = sessionId;
      const directAction = opened.ai.intentRoute?.functionName === 'rankSellerHouses' || opened.ai.intentRoute?.intent === 'search_similar_lots';
      if (opened.ai.generalInformation) {
        updates.push({ speaker: 'system', text: offTopicMessage(opened.ai) });
      } else if (!directAction || !opened.ai.intentRoute.readyForFunction) {
        if (opened.ai.extract.isRelevant === false || buildMissingFields(this.criteriaService.getSessionResponse(sessionId).criteria,
          this.criteriaService.getSessionResponse(sessionId).conversation).length > 0) {
          updates.push({ speaker: 'system', text: opened.ai.extract.isRelevant === false
            ? offTopicMessage(opened.ai) : opened.chat.text });
        }
      }
    } else {
      const directCriteriaAnswer = isBuyerCriteriaRefinement(trimmed);
      const priorContext = getBuyerConversationContext(sessionId);
      if (!isSkip && getBuyerCriteriaSession(sessionId)) {
        appendBuyerConversationContext(sessionId, { speaker: 'buyer', text: trimmed });
      }
      if (!isSkip && !directCriteriaAnswer) {
        const session = this.criteriaService.getSessionResponse(sessionId);
        language = session.criteria.language;
        lastAi = await this.p4Bridge.routeBuyerMessage(trimmed, language, {
          ...request.context,
          sessionId,
        }, priorContext);
        const previousAssistant = [...priorContext].reverse().find((entry) => entry.speaker === 'assistant')?.text;
        if (isAffirmativeFollowUp(trimmed) && isQuestion(previousAssistant) && lastAi) {
          lastAi.generalInformation = true;
          lastAi.intentRoute = { intent: 'general_information', functionName: null, readyForFunction: false };
          lastAi.readyForFunction = false;
          lastAi.functionParameters = null;
        }
      }
      if (lastAi?.generalInformation || lastAi?.extract.isRelevant === false) {
        updates.push({ speaker: 'system', text: offTopicMessage(lastAi) });
      } else if (lastAi?.intentRoute.functionName === 'rankSellerHouses') {
        if (!lastAi.readyForFunction) {
          updates.push({ speaker: 'system', text: language === 'he'
            ? 'באיזו קטגוריה לחפש בית מכירות מתמחה?'
            : 'Which category should the auction house specialize in?' });
        }
      } else if (lastAi?.intentRoute.intent === 'search_similar_lots') {
        // Without a P4 similar-lots function the cross-category search answers, so no prompt is needed.
        if (!lastAi.intentRoute.readyForFunction && !lastAi.intentRoute.missingFields?.includes(SHILAT_MISSING_SIMILAR_FUNCTION)) {
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
    for (const update of updates) {
      const text = updateContextText(update)?.trim();
      if (text && getBuyerCriteriaSession(sessionId)) {
        appendBuyerConversationContext(sessionId, { speaker: 'assistant', text });
      }
    }

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
    if (ai?.generalInformation || ai?.extract.isRelevant === false) {
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
