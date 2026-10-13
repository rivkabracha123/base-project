import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { SellerItemDraft } from '@monabid/shared';
import { SellerIntakeDraftsService } from './seller-intake-drafts.service';
import { SellerIntakeService } from './seller-intake.service';

describe('SellerIntakeDraftsService', () => {
  const rows: Array<Record<string, any>> = [];
  let service: SellerIntakeDraftsService;
  let sellerIntake: SellerIntakeService;
  let fixture: SellerItemDraft;

  beforeEach(() => {
    rows.length = 0;
    sellerIntake = new SellerIntakeService();
    const repository = {
      findOneBy: jest.fn(async (where: Record<string, string>) =>
        structuredClone(rows.find((row) => row.profileId === where.profileId && row.sessionId === where.sessionId) ?? null)),
      create: jest.fn((value: Record<string, unknown>) => ({ ...value })),
      save: jest.fn(async (record: Record<string, any>) => {
        const existingIndex = rows.findIndex((row) => row.profileId === record.profileId && row.sessionId === record.sessionId);
        const saved = { ...record, updatedAt: new Date() };
        if (existingIndex < 0) rows.push(saved);
        else rows[existingIndex] = saved;
        return saved;
      }),
    };
    service = new SellerIntakeDraftsService(repository as never, sellerIntake);
    fixture = {
      id: 'draft-1',
      feature: 'seller-conversation',
      developer: 's1',
      week: 5,
      status: 'draft',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
      language: { preferred: 'en', secondary: 'he', conversationMode: 'bilingual' },
      seller: { anonymousProfileId: 'profile-a', name: 'Synthetic Seller', preferredName: 'Seller' },
      conversation: { prompt: { he: '', en: '' }, assistantSummary: { he: '', en: '' } },
      item: {
        id: 'item-1',
        category: 'paintings',
        title: 'Painting',
        description: { he: '', en: '' },
        materials: [],
        dimensions: { values: [], widthCm: 40, heightCm: 30, unit: 'cm' },
        condition: 'Good condition',
        markings: 'Not yet confirmed',
        signatures: 'Signed',
        source: 'seller-intake',
        evidenceIds: [],
        catalogDraft: { he: '', en: '' },
      },
      evidence: [],
      confirmedFacts: {},
      uncertainFacts: [],
      revisionHistory: [],
      missingFields: ['dimensions', 'condition', 'marks', 'signatures', 'provenance'],
      sellerConfirmation: { required: true, status: 'pending' },
      handoff: { to: ['s3', 's4', 's5'], status: 'ready_for_review' },
      safetyRules: {
        sellerConfirmsExtractedFacts: true,
        askForMissingDimensionsConditionMarksSignaturesAndProvenance: true,
        weakEvidenceNeverProducesInventedPrice: true,
        noHouseRecommendation: true,
        noValuation: true,
        noContactCapture: true,
      },
    } as SellerItemDraft;
  });

  it('persists corrections and confirmations across separate service calls', async () => {
    await service.saveDraft('profile-a', 'session-1', fixture);
    const corrected = await service.correctDraft('profile-a', 'session-1', 'provenance', 'Family archive');
    const confirmed = await service.confirmFacts('profile-a', 'session-1', ['category', 'dimensions']);
    const loaded = await service.getDraft('profile-a', 'session-1');

    expect(corrected.version).toBe(2);
    expect(confirmed.version).toBe(3);
    expect(loaded.draft.confirmedFacts).toMatchObject({ category: 'paintings', provenance: 'Family archive' });
    expect(loaded.draft.item.catalogDraft.en).toContain('provenance: Family archive');
    expect(loaded.draft.revisionHistory).toHaveLength(2);
    expect(loaded.draft.recalculationRequired).toBe(true);
  });

  it('does not allow one profile to read another profile session', async () => {
    await service.saveDraft('profile-a', 'session-1', fixture);
    await expect(service.getDraft('profile-b', 'session-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects corrections with malformed values and attempts to confirm missing facts', async () => {
    await service.saveDraft('profile-a', 'session-1', fixture);
    await expect(service.correctDraft('profile-a', 'session-1', 'dimensions', { widthCm: 0, heightCm: 30 }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.confirmFacts('profile-a', 'session-1', ['provenance']))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('corrects localized title and description without marking them as confirmed facts', async () => {
    await service.saveDraft('profile-a', 'session-1', fixture);

    const title = await service.correctDraft('profile-a', 'session-1', 'title', { he: 'ציור עתיק' });
    const description = await service.correctDraft('profile-a', 'session-1', 'description', { en: 'An oil painting' });

    expect(title.draft.item.title).toBe('ציור עתיק');
    expect(title.draft.item.titleTranslations).toEqual({ he: 'ציור עתיק' });
    expect(description.draft.item.description).toEqual({ he: '', en: 'An oil painting' });
    expect(description.draft.confirmedFacts).not.toHaveProperty('title');
    expect(description.draft.confirmedFacts).not.toHaveProperty('description');
  });

  it('accepts arbitrary measurements and lets sellers clear optional facts', async () => {
    await service.saveDraft('profile-a', 'session-1', fixture);

    const dimensions = await service.correctDraft('profile-a', 'session-1', 'dimensions', [
      { label: 'ring size', value: 8, unit: 'ring_size' },
    ]);
    const materials = await service.correctDraft('profile-a', 'session-1', 'materials', []);
    const condition = await service.correctDraft('profile-a', 'session-1', 'condition', '');

    expect(dimensions.draft.item.dimensions.values).toEqual([
      { label: 'ring size', value: 8, unit: 'ring_size' },
    ]);
    expect(materials.draft.item.materials).toEqual([]);
    expect(condition.draft.item.condition).toBeUndefined();
    expect(condition.draft.missingFields).toContain('condition');
  });
});