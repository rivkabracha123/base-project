import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post } from '@nestjs/common';
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
  // מנתח טיוטת intake; שומר אותה רק כש-profileId ו-sessionId נשלחים יחד.
  // Analyzes an intake draft; persists it only when both profileId and sessionId are sent.
  async createDraft(@Body() body: Record<string, unknown>): Promise<Omit<SellerIntakeAiResult, 'sessionId'>> {
    const { input, sessionId, profileId } = body;
    if (typeof input !== 'string' || input.trim().length === 0) {
      throw new BadRequestException('input must be a non-empty string');
    }

    const hasProfileId = typeof profileId === 'string' && profileId.trim().length > 0;
    const hasSessionId = typeof sessionId === 'string' && sessionId.trim().length > 0;
    // Sending only one of the two identifiers is a client mistake, so reject it instead of silently skipping the save.
    if (hasProfileId !== hasSessionId) {
      throw new BadRequestException('profileId and sessionId must be sent together');
    }
    const hasScope = hasProfileId && hasSessionId;

    if (!hasScope) {
      const { sessionId: _sessionId, ...analysis } = await this.sellerIntakeAi.analyze(input);
      return analysis;
    }

    const scopedSessionId = `${profileId}:${sessionId}`;
    if (this.sellerIntakeAi.restoreSession && !this.sellerIntakeAi.hasSession?.(scopedSessionId)) {
      try {
        const saved = await this.drafts.getDraft(String(profileId), String(sessionId));
        this.sellerIntakeAi.restoreSession(scopedSessionId, saved.draft);
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    const { sessionId: _sessionId, structuredAnswer, functionCall, ai, ...analysis } = await this.sellerIntakeAi.analyze(
      input,
      scopedSessionId,
    );
    const stableId = createHash('sha256').update(scopedSessionId).digest('hex').slice(0, 24);
    const persistedDraft = {
      ...analysis,
      id: `seller-draft-${stableId}`,
      seller: { ...analysis.seller, anonymousProfileId: profileId },
      item: { ...analysis.item, id: `seller-item-${stableId}` },
    };
    await this.drafts.saveIntakeTurn(String(profileId), String(sessionId), persistedDraft);
    return { ...persistedDraft, structuredAnswer, functionCall, ai };
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
