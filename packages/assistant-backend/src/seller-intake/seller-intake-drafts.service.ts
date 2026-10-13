import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { SellerItemDraft } from '@monabid/shared';
import { Repository } from 'typeorm';
import { SellerIntakeDraftEntity } from '../database/seller-intake-draft.entity';
import { SellerIntakeService } from './seller-intake.service';

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
type CorrectionValue = string | string[] | { he?: string; en?: string } | { widthCm: number; heightCm: number }
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
      || !fields.every((field) => typeof field === 'string' && CORRECTABLE_FIELDS.includes(field as CorrectableField))) {
      throw new BadRequestException('fields must contain one or more supported seller facts');
    }
    const current = await this.getDraft(profileId, sessionId);
    let draft: SellerItemDraft;
    try {
      draft = this.sellerIntake.confirmSellerFacts(current.draft, fields as CorrectableField[]);
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
        throw new BadRequestException(`${field} correction requires at least one localized value`);
      }
      const localized = value as Record<string, unknown>;
      const localizedValues: { he?: string; en?: string } = {};
      for (const locale of Object.keys(localized)) {
        const text = localized[locale];
        if (!['he', 'en'].includes(locale) || typeof text !== 'string' || !text.trim()) {
          throw new BadRequestException(`${field} correction requires non-empty Hebrew or English text`);
        }
        localizedValues[locale as 'he' | 'en'] = text.trim();
      }
      if (Object.keys(localizedValues).length === 0) {
        throw new BadRequestException(`${field} correction requires non-empty Hebrew or English text`);
      }
      return localizedValues;
    }
    if (field === 'dimensions') {
      if (Array.isArray(value)) {
        if (!value.every((measurement) => measurement && typeof measurement === 'object'
          && typeof measurement.label === 'string' && measurement.label.trim()
          && typeof measurement.value === 'number' && Number.isFinite(measurement.value) && measurement.value > 0
          && typeof measurement.unit === 'string' && measurement.unit.trim())) {
          throw new BadRequestException('dimensions must contain measurements with a label, positive value and unit');
        }
        return value as { label: string; value: number; unit: string }[];
      }
      if (typeof value !== 'object' || value === null) {
        throw new BadRequestException('dimensions correction requires measurements');
      }
      const dimensions = value as Record<string, unknown>;
      if (typeof dimensions.widthCm !== 'number' || !Number.isFinite(dimensions.widthCm) || dimensions.widthCm <= 0
        || typeof dimensions.heightCm !== 'number' || !Number.isFinite(dimensions.heightCm) || dimensions.heightCm <= 0) {
        throw new BadRequestException('dimensions must contain positive numeric widthCm and heightCm');
      }
      return { widthCm: dimensions.widthCm, heightCm: dimensions.heightCm };
    }
    if (field === 'materials') {
      if (!Array.isArray(value)
        || !value.every((material) => typeof material === 'string' && material.trim())) {
        throw new BadRequestException('materials correction requires strings');
      }
      return value.map((material) => (material as string).trim());
    }
    if (typeof value !== 'string' || (field === 'category' && !value.trim())) {
      throw new BadRequestException(`${field} correction requires a string`);
    }
    return value.trim();
  }
}