import { HttpException, Injectable } from '@nestjs/common';
import { P4AiGenerateClient } from '../ai/p4-ai-generate.client';
import type { SellerHandoffContract } from '../ai/seller-handoff';
import { SellerIntakeAiMock } from './seller-intake-ai.mock';
import type { SellerIntakeAiProvider, SellerIntakeAiResult } from './seller-intake-ai.provider';

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
  constructor(
    private readonly intake: SellerIntakeAiMock,
    private readonly p4: P4AiGenerateClient,
  ) {}

  async analyze(input: string, sessionId?: string): Promise<SellerIntakeAiResult> {
    const language = /[\u0590-\u05FF]/.test(input) ? 'he' : 'en';
    let response: Awaited<ReturnType<P4AiGenerateClient['generateSellerExtract']>>;
    try {
      response = await this.p4.generateSellerExtract({
        prompt: input,
        language,
        sessionId,
      });
    } catch (error) {
      // Provider rate limits and temporary outages should not stop the seller
      // from sharing basic item details. Keep the response explicitly marked as
      // fixture/guided so downstream code never treats it as real AI extraction.
      if (error instanceof HttpException && error.getStatus() === 503) {
        const guided = this.intake.analyze(input, sessionId);
        return {
          ...guided,
          ai: {
            ...guided.ai,
            fallbackMode: 'guided',
            error: 'Real AI is temporarily unavailable; guided seller intake was used.',
          },
        };
      }
      throw error;
    }
    const structuredAnswer: SellerHandoffContract = response.structuredAnswer;
    const missingFields = mapAiFactsToIntakeFields(structuredAnswer.missingFacts);
    const draft = this.intake.createDraftFromAiExtraction(input, structuredAnswer);

    return {
      ...draft,
      provider: 'fixture-mock' as const,
      missingFields,
      nextQuestion: this.intake.nextQuestionForAiFields(missingFields),
      structuredAnswer,
      functionCall: null,
      ai: {
        provider: response.provider,
        mode: response.mode,
        isRelevant: response.isRelevant,
        error: response.error,
        aiMissingFields: missingFields,
      },
    };
  }
}
