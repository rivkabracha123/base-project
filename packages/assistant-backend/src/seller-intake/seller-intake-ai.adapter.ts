import { HttpException, Injectable } from '@nestjs/common';
import { P4AiGenerateClient } from '../ai/p4-ai-generate.client';
import type { SellerHandoffContract } from '../ai/seller-handoff';
import { SellerIntakeAiMock } from './seller-intake-ai.mock';
import type { SellerIntakeAiProvider, SellerIntakeAiResult } from './seller-intake-ai.provider';
import type { AiFunctionCall } from '../ai/ai.dto';
import type { SellerItemDraft } from '@monabid/shared';

function requestedReadAction(input: string, category: string, language: 'he' | 'en'): AiFunctionCall | null {
  if (/^(?:list my saved enquiries|\u05d4\u05e6\u05d2 \u05d0\u05ea \u05d4\u05e4\u05e0\u05d9\u05d5\u05ea \u05d4\u05e9\u05de\u05d5\u05e8\u05d5\u05ea \u05e9\u05dc\u05d9)[.!?\s]*$/i.test(input)) {
    return { functionToRun: 'listSellerLeads', object: {} };
  }
  if (/auction houses?|\u05d1\u05ea\u05d9 \u05de\u05db\u05d9\u05e8\u05d5\u05ea/i.test(input)
    && /recommended|suitable|\u05de\u05d5\u05de\u05dc\u05e6|\u05de\u05ea\u05d0\u05d9\u05dd/i.test(input)
    && category !== 'unknown' && category.trim()) {
    return { functionToRun: 'rankSellerHouses', object: { category, language } };
  }
  return null;
}

const FACT_TO_INTAKE_FIELD: Record<string, string> = {
  dimensions: 'dimensions',
  condition: 'condition',
  marks: 'marks',
  markings: 'marks',
  signature: 'signatures',
  signatures: 'signatures',
  provenance: 'provenance',
};

export function mapAiFactsToIntakeFields(facts: string[]): string[] {
  const mapped = facts
    .map((fact) => FACT_TO_INTAKE_FIELD[fact])
    .filter((field): field is string => Boolean(field));
  return [...new Set(mapped)];
}

// P4 extracts the seller facts; S1 only stores and presents the result.
@Injectable()
export class SellerIntakeAiAdapter implements SellerIntakeAiProvider {
  private readonly sessions = new Map<string, { input: string; dimensions: SellerHandoffContract['item']['dimensions']; nextField?: string; facts?: Record<string, string>; result?: SellerIntakeAiResult }>();
  constructor(
    private readonly intake: SellerIntakeAiMock,
    private readonly p4: P4AiGenerateClient,
  ) {}

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  restoreSession(sessionId: string, draft: SellerItemDraft): void {
    if (this.hasSession(sessionId)) return;
    const item = draft.item;
    const facts: Record<string, string> = {};
    for (const key of ['condition', 'markings', 'provenance'] as const) {
      if (item[key]?.trim()) facts[key] = item[key];
    }
    if (item.signatures?.trim()) facts.signature = item.signatures;
    const missingFields = ['dimensions', 'condition', 'marks', 'signatures', 'provenance'].filter(field =>
      field === 'dimensions' ? !item.dimensions.values.length
        : !facts[field === 'marks' ? 'markings' : field === 'signatures' ? 'signature' : field]);
    const result: SellerIntakeAiResult = {
      ...draft, provider: 'fixture-mock', missingFields,
      nextQuestion: this.intake.nextQuestionForAiFields(missingFields), structuredAnswer: null,
      ai: { provider: null, mode: null, isRelevant: true, error: null, aiMissingFields: missingFields },
    };
    this.sessions.set(sessionId, { input: item.description.he || item.description.en,
      dimensions: item.dimensions, facts, nextField: result.nextQuestion?.field, result });
  }

  async analyze(input: string, sessionId?: string): Promise<SellerIntakeAiResult> {
    const previous = sessionId ? this.sessions.get(sessionId) : undefined;
    const language = /[\u0590-\u05FF]/.test(input) ? 'he' : 'en';
    if (previous?.result) {
      const action = requestedReadAction(input, previous.result.item.category, language);
      if (action) return { ...previous.result, nextQuestion: null, functionCall: action };
    }
    const facts = { ...previous?.facts };
    const currentFacts: Record<string, string> = {};
    const field = previous?.nextField;
    const itemField = field === 'marks' ? 'markings' : field === 'signatures' ? 'signature' : field;
    const answer = input.trim();
    const isActionRequest = /auction houses?|saved enquiries|\u05d1\u05ea\u05d9 \u05de\u05db\u05d9\u05e8\u05d5\u05ea|\u05e4\u05e0\u05d9\u05d5\u05ea \u05d4\u05e9\u05de\u05d5\u05e8\u05d5\u05ea/i.test(answer);
    if (itemField && ['condition', 'markings', 'signature', 'provenance'].includes(itemField)
      && !isActionRequest
      && !/\b(?:condition|markings|signature|provenance)\b|\u05de\u05e6\u05d1|\u05e1\u05d9\u05de\u05d5\u05e0|\u05d7\u05ea\u05d9\u05de\u05d4|\u05de\u05e7\u05d5\u05e8/i.test(answer)
      && answer && !/^(?:yes|\u05db\u05df)[.!\s]*$/i.test(answer)
      && !answer.includes('?') && !/^(?:what|why|how|\u05de\u05d4|\u05dc\u05de\u05d4)\s/i.test(answer)) {
      currentFacts[itemField] = answer;
    }
    const negative = /^(?:\u05d0\u05d9\u05df|\u05dc\u05d0|no|none)[.!\s]*$/i.test(input.trim());
    if (negative && itemField === 'markings') currentFacts.markings = 'No markings reported';
    if (negative && itemField === 'signature') currentFacts.signature = 'No signature reported';
    Object.assign(facts, currentFacts);
    const contextualInput = negative && previous?.nextField === 'marks'
      ? 'no markings'
      : negative && previous?.nextField === 'signatures' ? 'not signed' : input;
    const combinedInput = previous ? `${previous.input}\n${contextualInput}` : contextualInput;
    let dimensions = previous?.dimensions;
    if (/\bring\b|\u05d8\u05d1\u05e2\u05ea/i.test(combinedInput)) {
      const sizes = [...combinedInput.matchAll(/(?:\bring\s+size|\bsize|\u05de\u05d9\u05d3\u05d4)\s*[:=]?\s*(\d+(?:\.\d+)?)(?![\d.]|\s*(?:cm|mm|\u05e1["\u05f4]?\u05de))/gi)];
      const size = sizes.at(-1);
      if (size) dimensions = { values: [{ label: 'ring_size', value: Number(size[1]), unit: 'size' }] };
    }
    let response: Awaited<ReturnType<P4AiGenerateClient['generateSellerExtract']>>;
    try {
      response = await this.p4.generateSellerExtract({
        prompt: previous ? `Previous seller details:\n${previous.input}\nLatest seller message:\n${contextualInput}` : combinedInput,
        language,
        sessionId,
      });
    } catch (error) {
      // Provider rate limits and temporary outages should not stop the seller
      // from sharing basic item details. Keep the response explicitly marked as
      // fixture/guided so downstream code never treats it as real AI extraction.
      if (error instanceof HttpException && error.getStatus() === 503) {
        if (!isActionRequest) {
          const fieldPatterns: Record<string, RegExp> = {
            condition: /\bcondition\b|\u05de\u05e6\u05d1/i,
            markings: /\bmarkings?\b|\u05e1\u05d9\u05de\u05d5\u05e0/i,
            signature: /\bsignature\b|\u05d7\u05ea\u05d9\u05de\u05d4/i,
            provenance: /\bprovenance\b|\u05de\u05e7\u05d5\u05e8/i,
          };
          for (const [key, pattern] of Object.entries(fieldPatterns)) {
            if (pattern.test(answer) && !answer.includes('?')) facts[key] = currentFacts[key] ?? answer;
          }
        }
        const guided = this.intake.applyAiDimensions(
          this.intake.analyze(combinedInput), dimensions?.values,
        );
        Object.assign(guided.item, facts, facts.signature ? { signatures: facts.signature } : {});
        const remaining = (guided.missingFields ?? []).filter(missing =>
          !facts[missing === 'marks' ? 'markings' : missing === 'signatures' ? 'signature' : missing]);
        guided.missingFields = remaining;
        guided.nextQuestion = this.intake.nextQuestionForAiFields(remaining);
        const result: SellerIntakeAiResult = {
          ...guided,
          functionCall: requestedReadAction(input, guided.item.category, language),
          ai: {
            ...guided.ai,
            fallbackMode: 'guided',
            error: 'Real AI is temporarily unavailable; guided seller intake was used.',
          },
        };
        if (sessionId) this.sessions.set(sessionId, { input: combinedInput, dimensions: guided.item.dimensions, nextField: guided.nextQuestion?.field, facts, result });
        return result;
      }
      throw error;
    }
    const structuredAnswer: SellerHandoffContract = response.structuredAnswer;
    if (structuredAnswer.category === 'unknown' && previous?.result?.item.category !== 'unknown' && previous?.result?.item.category) {
      structuredAnswer.category = previous.result.item.category;
    }
    if (/no markings/i.test(contextualInput)) currentFacts.markings = 'No markings reported';
    if (/not signed/i.test(contextualInput)) currentFacts.signature = 'No signature reported';
    for (const key of ['condition', 'markings', 'signature', 'provenance'] as const) {
      if (currentFacts[key]) structuredAnswer.item[key] = currentFacts[key];
      else if (!structuredAnswer.item[key]?.trim() && facts[key]) structuredAnswer.item[key] = facts[key];
      const value = structuredAnswer.item[key];
      if (value?.trim()) facts[key] = value;
    }
    if (!structuredAnswer.item.dimensions?.values.length && dimensions?.values.length) {
      structuredAnswer.item.dimensions = dimensions;
    }
    const missingFields = mapAiFactsToIntakeFields(structuredAnswer.missingFacts)
      .filter(field => (field !== 'dimensions' || !structuredAnswer.item.dimensions?.values.length)
        && (field !== 'marks' || !structuredAnswer.item.markings?.trim())
        && (field !== 'signatures' || !structuredAnswer.item.signature?.trim())
        && (field !== 'condition' || !structuredAnswer.item.condition?.trim())
        && (field !== 'provenance' || !structuredAnswer.item.provenance?.trim()));
    if (missingFields.length === 0) {
      const item = structuredAnswer.item;
      if (!item.dimensions?.values.length) missingFields.push('dimensions');
      if (!item.condition?.trim()) missingFields.push('condition');
      if (!item.markings?.trim()) missingFields.push('marks');
      if (!item.signature?.trim()) missingFields.push('signatures');
      if (!item.provenance?.trim()) missingFields.push('provenance');
    }
    const draft = this.intake.createDraftFromAiExtraction(combinedInput, structuredAnswer);
    const result: SellerIntakeAiResult = {
      ...draft,
      provider: 'fixture-mock' as const,
      missingFields,
      nextQuestion: this.intake.nextQuestionForAiFields(missingFields),
      structuredAnswer,
      functionCall: requestedReadAction(input, structuredAnswer.category, language) ?? response.functionCall ?? null,
      ai: {
        provider: response.provider,
        mode: response.mode,
        isRelevant: response.isRelevant,
        error: response.error,
        aiMissingFields: missingFields,
        summary: response.summary,
        nextAction: response.nextAction,
      },
    };
    if (sessionId) this.sessions.set(sessionId, { input: combinedInput, dimensions: structuredAnswer.item.dimensions,
      nextField: result.nextQuestion?.field, facts, result });
    return result;
  }
}
