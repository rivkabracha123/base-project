import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { SellerEvidenceReference, SellerItemDraft } from '@monabid/shared';
import { Repository } from 'typeorm';
import { SellerIntakeDraftEntity } from '../database/seller-intake-draft.entity';
import { SellerIntakeService } from './seller-intake.service';
import { createDeterministicSellerItemDraft } from './seller-intake-ai.mock';

const CORRECTABLE_FIELDS = [
  'title',
  'category',
  'description',
  'materials',
  'dimensions',
  'condition',
  'marks',
  'signatures',
  'provenance',
] as const;

type CorrectableField = (typeof CORRECTABLE_FIELDS)[number];
const CONFIRMABLE_FIELDS = CORRECTABLE_FIELDS.filter(
  (field): field is Exclude<CorrectableField, 'title' | 'description'> => field !== 'title' && field !== 'description',
);

type LocalizedCorrection = Partial<Record<'he' | 'en', string>>;
type DimensionCorrection =
  | { widthCm: number; heightCm: number }
  | { values: Array<{ label: string; value: number; unit: string }> };
type CorrectionValue = string | string[] | DimensionCorrection | LocalizedCorrection
  | { label: string; value: number; unit: string }[];

@Injectable()
export class SellerIntakeDraftsService {
  constructor(
    @InjectRepository(SellerIntakeDraftEntity)
    private readonly drafts: Repository<SellerIntakeDraftEntity>,
    @Inject(SellerIntakeService)
    private readonly sellerIntake: SellerIntakeService,
  ) {}

  // שומר טיוטת מוכרת ומעלה את מספר הגרסה עבור אותו פרופיל ושיחה.
  // Persists a seller draft and increments its version for the given profile and session.
  async saveDraft(profileId: string, sessionId: string, draft: SellerItemDraft): Promise<SellerIntakeDraftEntity> {
    const existing = await this.drafts.findOneBy({ profileId, sessionId });
    const record = existing ?? this.drafts.create({ profileId, sessionId, draft, version: 0 });
    record.draft = draft;
    record.version += 1;
    return this.drafts.save(record);
  }

  // שומר תור intake חדש תוך מיזוג עובדות ותיקונים שכבר אושרו.
  // Persists a new intake turn while retaining previously confirmed facts and corrections.
  async saveIntakeTurn(profileId: string, sessionId: string, draft: SellerItemDraft): Promise<SellerIntakeDraftEntity> {
    const existing = await this.drafts.findOneBy({ profileId, sessionId });
    const nextDraft = existing
      ? this.sellerIntake.mergeNewIntakeTurn(existing.draft, draft)
      : draft;
    return this.saveDraft(profileId, sessionId, nextDraft);
  }

  // טוען טיוטה לפי פרופיל ושיחה ומחזיר 404 אם היא לא קיימת.
  // Loads a draft by profile and session, returning 404 when it does not exist.
  async getDraft(profileId: string, sessionId: string): Promise<SellerIntakeDraftEntity> {
    const record = await this.drafts.findOneBy({ profileId, sessionId });
    if (!record) throw new NotFoundException('Seller intake draft was not found');
    return record;
  }

  // מצרף הפניות לתמונות ש-S2 שמרה לטיוטה של אותו פרופיל ושיחה, בלי לאשר שום עובדה.
  // מחזיר null כשעדיין אין טיוטה: התמונות כבר שמורות אצל S2 ואין למה לצרף.
  // Attaches the photo references S2 stored to the draft of the same profile and session, without confirming any fact.
  // Returns null when there is no draft yet: the photos are already stored by S2, so there is nothing to attach to.
  async attachEvidence(
    profileId: string,
    sessionId: string,
    references: SellerEvidenceReference[],
  ): Promise<SellerIntakeDraftEntity | null> {
    const current = await this.drafts.findOneBy({ profileId, sessionId });
    if (!current && references.length === 0) return null;
    const empty = this.sellerIntake.createDraftFromSellerInput(createDeterministicSellerItemDraft(), '');
    empty.seller = { anonymousProfileId: profileId, name: 'Anonymous seller', preferredName: 'Anonymous seller' };
    empty.evidence = [];
    empty.item.evidenceIds = [];
    empty.uncertainFacts = [];
    empty.revisionHistory = [];
    const draft = this.sellerIntake.attachEvidenceReferences(current?.draft ?? empty, references);
    return this.saveDraft(profileId, sessionId, draft);
  }

  async detachEvidence(profileId: string, sessionId: string, fileId: string): Promise<SellerIntakeDraftEntity> {
    const current = await this.getDraft(profileId, sessionId);
    const draft = { ...current.draft, evidence: current.draft.evidence.filter(entry => entry.id !== fileId),
      item: { ...current.draft.item, evidenceIds: current.draft.item.evidenceIds.filter(id => id !== fileId) } };
    return this.saveDraft(profileId, sessionId, draft);
  }

  // מאמת תיקון של שדה, מעדכן את הטיוטה ושומר את הגרסה החדשה.
  // Validates a field correction, updates the draft, and persists the new version.
  async correctDraft(
    profileId: string,
    sessionId: string,
    field: unknown,
    value: unknown,
  ): Promise<SellerIntakeDraftEntity> {
    if (typeof field !== 'string' || !CORRECTABLE_FIELDS.includes(field as CorrectableField)) {
      throw new BadRequestException('Unsupported seller fact correction');
    }
    const normalizedValue = this.validateCorrection(field as CorrectableField, value);
    const current = await this.getDraft(profileId, sessionId);
    const draft = this.sellerIntake.applySellerDraftCorrection(
      current.draft,
      field as CorrectableField,
      normalizedValue,
    );
    return this.saveDraft(profileId, sessionId, draft);
  }

  // מאמת את רשימת העובדות שהמוכרת אישרה ושומר את מצב האישור החדש.
  // Validates the seller-approved fact list and persists the updated confirmation state.
  async confirmFacts(
    profileId: string,
    sessionId: string,
    fields: unknown,
  ): Promise<SellerIntakeDraftEntity> {
    if (!Array.isArray(fields) || fields.length === 0
      || !fields.every((field) => typeof field === 'string' && CONFIRMABLE_FIELDS.includes(field as Exclude<CorrectableField, 'title' | 'description'>))) {
      throw new BadRequestException('fields must contain one or more supported seller facts');
    }
    const current = await this.getDraft(profileId, sessionId);
    let draft: SellerItemDraft;
    try {
      draft = this.sellerIntake.confirmSellerFacts(
        current.draft,
        fields as Exclude<CorrectableField, 'title' | 'description'>[],
      );
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Seller facts could not be confirmed');
    }
    return this.saveDraft(profileId, sessionId, draft);
  }

  // בודק ומנרמל ערכי תיקון לפי סוג השדה לפני עדכון הטיוטה.
  // Validates and normalizes correction values according to the field before updating the draft.
  private validateCorrection(field: CorrectableField, value: unknown): CorrectionValue {
    if (field === 'title' || field === 'description') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new BadRequestException(`${field} correction requires a Hebrew or English value`);
      }
      const localized = value as Record<string, unknown>;
      const entries = Object.entries(localized);
      if (entries.length === 0 || entries.some(([language, text]) =>
        !['he', 'en'].includes(language) || typeof text !== 'string' || !text.trim())) {
        throw new BadRequestException(`${field} must contain non-empty he or en strings`);
      }
      return Object.fromEntries(entries.map(([language, text]) => [language, (text as string).trim()])) as LocalizedCorrection;
    }
    if (field === 'dimensions') {
      if (Array.isArray(value)) {
        if (!value.every((measurement) => measurement && typeof measurement === 'object'
          && typeof measurement.label === 'string' && measurement.label.trim()
          && typeof measurement.value === 'number' && Number.isFinite(measurement.value) && measurement.value > 0
          && typeof measurement.unit === 'string' && measurement.unit.trim())) {
          throw new BadRequestException('dimensions must contain measurements with a label, positive value and unit');
        }
        return value.map((measurement) => ({
          label: measurement.label.trim(),
          value: measurement.value,
          unit: measurement.unit.trim(),
        })) as { label: string; value: number; unit: string }[];
      }
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new BadRequestException('dimensions correction requires measurements');
      }
      const dimensions = value as Record<string, unknown>;
      if (Array.isArray(dimensions.values)) {
        if (!dimensions.values.every((measurement) =>
          typeof measurement === 'object' && measurement !== null
          && typeof measurement.label === 'string' && measurement.label.trim()
          && typeof measurement.value === 'number' && Number.isFinite(measurement.value) && measurement.value > 0
          && typeof measurement.unit === 'string' && measurement.unit.trim())) {
          throw new BadRequestException('dimensions values must contain labels, positive numbers, and units');
        }
        return {
          values: dimensions.values.map((measurement) => ({
            label: measurement.label.trim(),
            value: measurement.value,
            unit: measurement.unit.trim(),
          })),
        };
      }
      if (typeof dimensions.widthCm !== 'number' || !Number.isFinite(dimensions.widthCm) || dimensions.widthCm <= 0
        || typeof dimensions.heightCm !== 'number' || !Number.isFinite(dimensions.heightCm) || dimensions.heightCm <= 0) {
        throw new BadRequestException('dimensions must contain positive numeric widthCm and heightCm or values');
      }
      return { widthCm: dimensions.widthCm, heightCm: dimensions.heightCm };
    }
    if (field === 'materials') {
      if (!Array.isArray(value) || !value.every((material) => typeof material === 'string' && material.trim())) {
        throw new BadRequestException('materials correction requires strings');
      }
      return value.map((material: string) => material.trim());
    }
    if (['condition', 'marks', 'signatures', 'provenance'].includes(field)
      && typeof value === 'string' && !value.trim()) {
      return '';
    }
    if (typeof value !== 'string' || (field === 'category' && !value.trim())) {
      throw new BadRequestException(`${field} correction requires a string`);
    }
    return value.trim();
  }
}
