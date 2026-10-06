import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SELLER_INTAKE_AI_PROVIDER, type SellerIntakeAiProvider, type SellerIntakeAiResult } from './seller-intake-ai.provider';
import { SellerIntakeDraftsService } from './seller-intake-drafts.service';

// Receives seller messages and returns their extracted draft information.
@Controller('seller-intake')
export class SellerIntakeController {
  constructor(
    @Inject(SELLER_INTAKE_AI_PROVIDER) private readonly sellerIntakeAi: SellerIntakeAiProvider,
    private readonly drafts: SellerIntakeDraftsService,
  ) {}

  @Post('draft')
  // מנתח ושומר טיוטת intake המבודדת לפי מזהי הפרופיל והשיחה.
  // Analyzes and persists an intake draft scoped to the profile and session identifiers.
  async createDraft(@Body() body: Record<string, unknown>): Promise<Omit<SellerIntakeAiResult, 'sessionId'>> {
    const { input, sessionId, profileId } = body;
    if (typeof input !== 'string' || input.trim().length === 0) {
      throw new BadRequestException('input must be a non-empty string');
    }
    if (typeof profileId !== 'string' || !profileId.trim()) {
      throw new BadRequestException('profileId is required');
    }
    if (typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new BadRequestException('sessionId is required');
    }

    const scopedSessionId = `${profileId}:${sessionId}`;
    const { sessionId: _sessionId, structuredAnswer, ai, ...analysis } = await this.sellerIntakeAi.analyze(input, scopedSessionId);
    const stableId = createHash('sha256').update(scopedSessionId).digest('hex').slice(0, 24);
    const persistedDraft = {
      ...analysis,
      id: `seller-draft-${stableId}`,
      seller: { ...analysis.seller, anonymousProfileId: profileId },
      item: { ...analysis.item, id: `seller-item-${stableId}` },
    };
    await this.drafts.saveIntakeTurn(profileId, sessionId, persistedDraft);
    return { ...persistedDraft, structuredAnswer, ai };
  }

  @Get('draft/:profileId/:sessionId')
  // מחזיר טיוטה שמורה של הפרופיל והשיחה המבוקשים.
  // Returns the persisted draft for the requested profile and session.
  getDraft(
    @Param('profileId') profileId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.drafts.getDraft(profileId, sessionId);
  }

  @Patch('draft/:profileId/:sessionId/corrections')
  // מקבל תיקון של המוכרת ומחזיר את הטיוטה לאחר שמירתו.
  // Applies a seller correction and returns the persisted updated draft.
  correctDraft(
    @Param('profileId') profileId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.drafts.correctDraft(profileId, sessionId, body.field, body.value);
  }

  @Post('draft/:profileId/:sessionId/confirm')
  // מקבל אישור מפורש לעובדות שנבחרו ושומר את מצב האישור.
  // Records explicit seller approval for selected facts and persists the confirmation state.
  confirmFacts(
    @Param('profileId') profileId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.drafts.confirmFacts(profileId, sessionId, body.fields);
  }
}
