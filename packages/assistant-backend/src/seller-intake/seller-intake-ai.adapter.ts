import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import type { SellerHandoffContract } from '../ai/seller-handoff';
import { isSellerHandoffContract } from '../ai/seller-handoff';
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

// The draft comes from the S1 intake service; AiService only enriches it.
@Injectable()
export class SellerIntakeAiAdapter implements SellerIntakeAiProvider {
  constructor(
    private readonly intake: SellerIntakeAiMock,
    private readonly aiService: AiService,
  ) {}

  async analyze(input: string, sessionId?: string): Promise<SellerIntakeAiResult> {
    const intakeResult = this.intake.analyze(input, sessionId);
    const language = /[\u0590-\u05FF]/.test(input) ? 'he' : 'en';

    try {
      const response = await this.aiService.generate({ prompt: input, role: 'seller', language, sessionId });
      const structuredAnswer: SellerHandoffContract | null = isSellerHandoffContract(response.structuredAnswer)
        ? response.structuredAnswer
        : null;

      return {
        ...intakeResult,
        structuredAnswer,
        ai: {
          provider: response.provider,
          mode: response.mode,
          ...(response.fallbackMode ? { fallbackMode: response.fallbackMode } : {}),
          isRelevant: response.isRelevant,
          error: structuredAnswer ? response.error : response.error ?? 'invalid_response',
          aiMissingFields: structuredAnswer ? mapAiFactsToIntakeFields(structuredAnswer.missingFacts) : [],
        },
      };
    } catch {
      return {
        ...intakeResult,
        structuredAnswer: null,
        ai: { provider: null, mode: null, isRelevant: true, error: 'unavailable', aiMissingFields: [] },
      };
    }
  }
}
