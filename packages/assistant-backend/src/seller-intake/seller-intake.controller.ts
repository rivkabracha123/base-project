import { BadRequestException, Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { createHash, randomUUID } from 'node:crypto';
import { MAX_FILES_PER_UPLOAD, MAX_FILE_SIZE_BYTES, type UploadedFile } from '../uploads/evidence.types';
import { UploadsService } from '../uploads/uploads.service';
import { SELLER_INTAKE_AI_PROVIDER, type SellerIntakeAiProvider, type SellerIntakeAiResult } from './seller-intake-ai.provider';
import { SellerIntakeDraftsService } from './seller-intake-drafts.service';
import { requestedSellerComparison, type SellerComparisonAction } from '../seller-workflow/seller-comparison-action';
import { sellerItemReady } from './seller-item-readiness';

// Receives seller messages and returns their extracted draft information.
@Controller('seller-intake')
export class SellerIntakeController {
  private readonly pendingValuations = new Set<string>();
  private readonly pendingComparisons = new Map<string, SellerComparisonAction>();
  constructor(
    @Inject(SELLER_INTAKE_AI_PROVIDER) private readonly sellerIntakeAi: SellerIntakeAiProvider,
    private readonly drafts: SellerIntakeDraftsService,
    private readonly uploads: UploadsService,
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
    const previousComparison = this.pendingComparisons.get(scopedSessionId);
    const previousValuation = this.pendingValuations.has(scopedSessionId);
    if (/\b(?:cancel|don't|do not)\b|בטל|לא\s+(?:רוצה|מעוניי?נ)/i.test(input)) this.pendingComparisons.delete(scopedSessionId);
    const comparison = requestedSellerComparison(input);
    if (comparison) this.pendingComparisons.set(scopedSessionId, comparison);
    if (comparison) {
      try {
        const saved = await this.drafts.getDraft(String(profileId), String(sessionId));
        const item = saved.draft.item;
        if (sellerItemReady(item)) {
          this.pendingComparisons.delete(scopedSessionId);
          return { ...saved.draft, provider: 'fixture-mock', missingFields: saved.draft.missingFields ?? [], requiredMissingFields: [], nextQuestion: null, structuredAnswer: null,
            ai: { provider: null, mode: null, isRelevant: true, error: null, aiMissingFields: [] },
            functionCall: { functionToRun: comparison, object: { sessionId: String(sessionId) } } };
        }
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    const asksValuation = /valuation|apprais(?:al|e)|estimate(?:d)? (?:value|price)|\u05d4\u05e2\u05e8\u05db\u05ea?\s+\u05e9\u05d5\u05d5\u05d9|\u05db\u05de\u05d4\s+.*\u05e9\u05d5\u05d5\u05d4/i.test(input);
    const declinesValuation = /\b(?:don't|do not|cancel)\b|\u05dc\u05d0\s+(?:\u05e8\u05d5\u05e6\u05d4|\u05de\u05e2\u05d5\u05e0\u05d9\u05d9\u05e0)|\u05d1\u05d8\u05dc/i.test(input);
    if (asksValuation) {
      if (declinesValuation) this.pendingValuations.delete(scopedSessionId);
      else this.pendingValuations.add(scopedSessionId);
    }
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
    if (ai?.isRelevant === false || ai?.generalInformation) {
      if (previousComparison) this.pendingComparisons.set(scopedSessionId, previousComparison);
      else this.pendingComparisons.delete(scopedSessionId);
      if (previousValuation) this.pendingValuations.add(scopedSessionId);
      else this.pendingValuations.delete(scopedSessionId);
      return { ...analysis, structuredAnswer, ai, functionCall: null, nextQuestion: null };
    }
    const stableId = createHash('sha256').update(scopedSessionId).digest('hex').slice(0, 24);
    const persistedDraft = {
      ...analysis,
      id: `seller-draft-${stableId}`,
      seller: { ...analysis.seller, anonymousProfileId: profileId },
      item: { ...analysis.item, id: `seller-item-${stableId}` },
    };
    await this.drafts.saveIntakeTurn(String(profileId), String(sessionId), persistedDraft);
    if (asksValuation && !declinesValuation && analysis.requiredMissingFields?.length === 0) {
      this.pendingValuations.delete(scopedSessionId);
      this.pendingComparisons.delete(scopedSessionId);
      return { ...persistedDraft, structuredAnswer, ai, nextQuestion: null,
        functionCall: { functionToRun: 'calculateSellerValuation', object: { sessionId: String(sessionId) } } };
    }
    const pendingComparison = this.pendingComparisons.get(scopedSessionId);
    if (pendingComparison && analysis.requiredMissingFields?.length === 0) {
      this.pendingComparisons.delete(scopedSessionId);
      return { ...persistedDraft, structuredAnswer, ai, nextQuestion: null,
        functionCall: { functionToRun: pendingComparison, object: { sessionId: String(sessionId) } } };
    }
    if (this.pendingValuations.has(scopedSessionId) && analysis.requiredMissingFields?.length === 0
      && (!functionCall?.functionToRun || functionCall.functionToRun === 'calculateSellerValuation')) {
      this.pendingValuations.delete(scopedSessionId);
      return { ...persistedDraft, structuredAnswer, ai, nextQuestion: null,
        functionCall: { functionToRun: 'calculateSellerValuation', object: { sessionId: String(sessionId) } } };
    }
    return { ...persistedDraft, structuredAnswer, functionCall, ai };
  }

  @Post('draft/:profileId/:sessionId/photos')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  // מקבל מהצ'אט (B1) את תמונות המוכרת יחד עם הפרופיל של P3, מעביר אותן ל-S2 לשמירה ומצרף את ההפניות לטיוטה.
  // העלאה אחת = פריט אחד. כללי הקבצים (סוג, גודל, עד 10) נבדקים ב-S2. מחזיר רק את תמונות ההעלאה הזאת.
  // Receives the seller's photos from the chat (B1) with the P3 profile, hands them to S2 for storage, and attaches the
  // references to the draft. One upload = one item. The file rules (type, size, up to 10) are checked by S2.
  // Returns only the photos of this upload.
  async uploadPhotos(
    @Param('profileId') profileId: string,
    @Param('sessionId') sessionId: string,
    @UploadedFiles() files: UploadedFile[],
  ) {
    const itemId = `seller-photos-${randomUUID()}`;
    const stored = await this.uploads.addEvidence(profileId, itemId, files ?? []);
    const references = stored.filter((reference) => reference.itemId === itemId);
    await this.drafts.attachEvidence(profileId, sessionId, references);
    return references;
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

  @Delete('draft/:profileId/:sessionId/photos/:fileId')
  async removePhoto(@Param('profileId') profileId: string, @Param('sessionId') sessionId: string, @Param('fileId') fileId: string) {
    const saved = await this.drafts.getDraft(profileId, sessionId);
    if (!saved.draft.evidence.some(entry => entry.id === fileId && entry.type === 'photo')) {
      throw new NotFoundException('Photo was not found in this item');
    }
    await this.uploads.deleteEvidence(profileId, fileId);
    return this.drafts.detachEvidence(profileId, sessionId, fileId);
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
