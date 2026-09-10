import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { SellerItemDraft } from '@monabid/shared';
import { SellerIntakeService } from './seller-intake.service';

// Simulates Shilat Ben Gigi — AI connection: deterministic fixture-backed seller-intake output.
@Injectable()
export class SellerIntakeAiMock {
  constructor(private readonly sellerIntakeService: SellerIntakeService) {}

  analyze(input: string): SellerItemDraft & {
    provider: 'fixture-mock';
    missingFields: string[];
  } {
    const fixturePath = resolve(__dirname, '../../../../fixtures/demo-scenarios/seller-item-draft.json');
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as SellerItemDraft;
    const reviewState = this.sellerIntakeService.buildReviewState(input);

    return {
      ...this.sellerIntakeService.createDraftFromSellerInput(fixture, input),
      missingFields: this.sellerIntakeService.askMissingSellerDetails(reviewState),
      provider: 'fixture-mock' as const,
    };
  }
}
