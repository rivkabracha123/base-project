import { BadRequestException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { submitSellerLeadSchema } from '@monabid/shared';
import { P4AiGenerateClient } from '../ai/p4-ai-generate.client';
import { SELLER_INTAKE_AI_PROVIDER, type SellerIntakeAiProvider } from '../seller-intake/seller-intake-ai.provider';
import { SellerLeadsService } from '../seller-leads/seller-leads.service';
import { toSellerLeadDashboardDetail } from '../seller-leads/seller-lead-dashboard';
import { UploadsService } from '../uploads/uploads.service';
import { SellerIntakeDraftsService } from '../seller-intake/seller-intake-drafts.service';
import { ItemValuationService } from '../valuation-calculation/item-valuation.service';
import { ComparablesService } from '../comparables/comparables.service';
import { sellerComparisonCategory, sellerItemReady } from '../seller-intake/seller-item-readiness';
import type { SellerFunctionName, SellerFunctionResponse, SellerWorkflowRequest, SellerWorkflowResult, SellerWorkflowResultCallback } from './seller-workflow.types';

const SELLER_FUNCTIONS = new Set<SellerFunctionName>([
  'searchSellerComparables', 'getSellerComparableHistory', 'getSellerPriceTrend', 'getSellerItemDetails',
  'getSellerCatalogDraft', 'getSellerEnquiryPreview', 'getSellerProvenanceAdvice', 'getSellerHouseRecommendation',
  'calculateSellerValuation',
  'analyzeSellerIntake',
  'createSellerLeadDraft', 'createSellerLead',
  'rankSellerHouses', 'rankAndStoreSellerHouses', 'rankHousesForLead',
  'chooseSellerHouse', 'saveSellerHouseChoice', 'submitFinalSellerLead',
  'listSellerLeads', 'getSellerLead', 'listEvidence', 'uploadEvidence',
  'getEvidenceFile', 'reorderEvidence', 'deleteEvidence',
]);

function requiredString(object: Record<string, unknown>, field: string): string {
  const value = object[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`Seller function requires ${field}`);
  }
  return value.trim();
}

function optionalString(object: Record<string, unknown>, field: string): string | undefined {
  const value = object[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new BadRequestException(`Seller function ${field} must be a string`);
  return value.trim() || undefined;
}

@Injectable()
export class SellerWorkflowService {
  constructor(
    @Inject(SELLER_INTAKE_AI_PROVIDER) private readonly sellerIntakeAi: SellerIntakeAiProvider,
    private readonly sellerLeads: SellerLeadsService,
    @Optional() private readonly uploads?: UploadsService,
    @Optional() private readonly drafts?: SellerIntakeDraftsService,
    @Optional() private readonly itemValuation?: ItemValuationService,
    @Optional() private readonly comparables?: ComparablesService,
    @Optional() private readonly p4?: P4AiGenerateClient,
  ) {}

  async execute(
    request: SellerWorkflowRequest,
    callback: SellerWorkflowResultCallback = () => undefined,
  ): Promise<SellerWorkflowResult> {
    if (!request.profileId.trim()) {
      throw new BadRequestException('profileId is required');
    }

    const functionResponse = this.validateFunctionResponse({
      functionToRun: request.structuredAnswer?.functionToRun,
      object: request.structuredAnswer?.object,
    });
    const result = await this.dispatch(functionResponse, request.profileId);
    const response: SellerWorkflowResult = { functionToRun: functionResponse.functionToRun, result };
    await callback(response);
    return response;
  }

  private validateFunctionResponse(response: { functionToRun: unknown; object: unknown }): SellerFunctionResponse {
    if (!response || typeof response !== 'object' || !('functionToRun' in response)) {
      throw new BadRequestException('Shilat response must include functionToRun and object');
    }
    const value = response as { functionToRun: unknown; object: unknown };
    if (value.functionToRun === null) {
      if (value.object !== null) throw new BadRequestException('object must be null when no function is requested');
      return { functionToRun: null, object: null };
    }
    if (typeof value.object !== 'object' || value.object === null || Array.isArray(value.object)) {
      throw new BadRequestException('object must match the requested seller function');
    }

    const functionToRun = value.functionToRun;
    if (typeof functionToRun !== 'string' || !SELLER_FUNCTIONS.has(functionToRun as SellerFunctionName)) {
      throw new BadRequestException('Shilat requested a seller function outside the agreed contract');
    }
    return { functionToRun: functionToRun as SellerFunctionName, object: value.object as Record<string, unknown> };
  }

  private async dispatch(
    action: SellerFunctionResponse,
    profileId: string,
  ): Promise<unknown> {
    switch (action.functionToRun) {
      case 'searchSellerComparables':
      case 'getSellerComparableHistory':
      case 'getSellerPriceTrend':
      case 'getSellerItemDetails': {
        if (!this.drafts) throw new BadRequestException('Seller draft service is unavailable');
        const saved = await this.drafts.getDraft(profileId, requiredString(action.object, 'sessionId'));
        const item = saved.draft.item;
        if (!sellerItemReady(item)) {
          throw new BadRequestException('Seller actions require category, dimensions and condition');
        }
        if (action.functionToRun === 'getSellerItemDetails') return { item, evidence: saved.draft.evidence };
        if (!this.comparables) throw new BadRequestException('Seller comparison service is unavailable');
        const category = sellerComparisonCategory(item.category, `${item.title}\n${item.description?.he ?? ''}\n${item.description?.en ?? ''}`);
        const criteria = { category, ...(saved.draft.confirmedFacts.materials?.length ? { materials: saved.draft.confirmedFacts.materials } : {}) };
        const evidence = await this.comparables.findComparables(criteria);
        // Available items and completed sales belong to separate actions.
        const matches = action.functionToRun === 'searchSellerComparables'
          ? [...evidence.included, ...evidence.excluded].filter((match) => match.lot.status === 'upcoming' && match.lot.category === criteria.category && match.score >= 0.8)
          : evidence.included.filter((match) => match.lot.status === 'sold');
        return { criteria, lots: matches.map((match) => match.lot).sort((a, b) => a.saleDate.localeCompare(b.saleDate) || a.id.localeCompare(b.id)) };
      }
      case 'getSellerCatalogDraft':
      case 'getSellerEnquiryPreview':
      case 'getSellerHouseRecommendation':
      case 'getSellerProvenanceAdvice': {
        if (!this.drafts) throw new BadRequestException('Seller draft service is unavailable');
        const saved = await this.drafts.getDraft(profileId, requiredString(action.object, 'sessionId'));
        if (!sellerItemReady(saved.draft.item)) throw new BadRequestException('Seller actions require category, dimensions and condition');
        const category = sellerComparisonCategory(saved.draft.item.category, saved.draft.item.title);
        if (action.functionToRun === 'getSellerHouseRecommendation') return { ...this.sellerLeads.rankHouses({ category }), category };
        if (action.functionToRun === 'getSellerProvenanceAdvice') return { text: {
          he: 'תיעוד אמין של מקור הפריט עשוי לסייע בבדיקת הזיהוי והאותנטיות. אי אפשר לקבוע בכמה ישתנה השווי בלי לבדוק את התיעוד ואת הפריט. ההערכה הקיימת אינה כוללת תוספת שווי משוערת עבור תיעוד שלא נבדק.',
          en: 'Reliable provenance can help verify identity and authenticity. Its effect on value requires reviewing the documents and the item. The current valuation does not add an assumed premium for unverified provenance.',
        } };
        if (action.functionToRun === 'getSellerCatalogDraft') return { title: saved.draft.item.title, ...saved.draft.item.catalogDraft };
        const language = optionalString(action.object, 'language') === 'en' ? 'en' : 'he';
        const item = saved.draft.item;
        const facts = {
          category: item.category,
          title: item.title,
          catalogDescription: item.catalogDraft?.[language] || item.description?.[language] || '',
          materials: item.materials ?? [],
          dimensions: item.dimensions?.values ?? [],
          condition: item.condition ?? '',
          markings: item.markings ?? '',
          signatures: item.signatures ?? '',
          provenance: item.provenance ?? '',
        };
        const prompt = [
          'Write a concise, polished and respectful seller enquiry in the requested language.',
          'The text should include a brief catalog-style description and a courteous request for the recipient to review the item for possible sale.',
          'Do not name a specific auction house. Do not invent or infer facts, condition, attribution, provenance, authenticity, value, or acceptance.',
          'Use only the supplied item facts. Return only the finished message as plain text, with no markdown or form fields.',
          JSON.stringify(facts),
        ].join('\n\n');
        let generatedByAi = false;
        let enquiryText: string | null = null;
        if (this.p4) {
          try {
            enquiryText = await this.p4.generateSellerEnquiryCopy({
              prompt,
              language,
              sessionId: requiredString(action.object, 'sessionId'),
            });
            generatedByAi = enquiryText !== null;
          } catch (error) {
            if (!(error instanceof ServiceUnavailableException)) throw error;
          }
        }
        if (!enquiryText) {
          const description = facts.catalogDescription.trim() || item.title;
          enquiryText = language === 'he'
            ? `שלום רב,\n\nאשמח לקבל את חוות דעתכם בנוגע לאפשרות להציע את הפריט הבא למכירה:\n${item.title}\n${description}\n\nאודה לכם אם תוכלו לעיין בפרטים ולעדכן אם הפריט עשוי להתאים. אשמח למסור מידע נוסף לפי הצורך.\n\nתודה רבה.`
            : `Hello,\n\nI would appreciate your opinion on whether the following item may be suitable for sale:\n${item.title}\n${description}\n\nPlease review the details and let me know whether the item may be a fit. I would be happy to provide further information if needed.\n\nThank you.`;
        }
        return {
          draft: saved.draft,
          enquiryText,
          generatedByAi,
        };
      }
      case 'calculateSellerValuation': {
        if (!this.drafts || !this.itemValuation) throw new BadRequestException('Seller valuation is unavailable');
        // Read the authenticated profile's saved item, never model-supplied prices or item IDs.
        const saved = await this.drafts.getDraft(profileId, requiredString(action.object, 'sessionId'));
        const item = saved.draft.item;
        if (!sellerItemReady(item)) {
          throw new BadRequestException('Seller valuation requires category, dimensions and condition');
        }
        const report = await this.itemValuation.calculateFromItem({ itemId: item.id, itemVersion: `v${saved.version}`, item });
        const evidence = this.comparables ? await this.comparables.findComparables(item) : undefined;
        const ids = new Set(report.includedComparableIds ?? []);
        return { ...report, lots: evidence?.included.filter(entry => entry.lot.status === 'sold' && ids.has(entry.lot.id)).map(entry => entry.lot) ?? [] };
      }
      case null:
        return null;
      case 'analyzeSellerIntake':
        return this.sellerIntakeAi.analyze(requiredString(action.object, 'input'));
      case 'createSellerLeadDraft':
      case 'createSellerLead': {
        const requestedProfileId = requiredString(action.object, 'profileId');
        this.requireSameProfile(requestedProfileId, profileId);
        const rawContact = action.object.contact;
        const contact = rawContact && typeof rawContact === 'object' && !Array.isArray(rawContact)
          ? rawContact as Record<string, unknown>
          : { preferredName: action.object.name, email: action.object.email, phone: action.object.phone };
        const preferredName = typeof contact.preferredName === 'string'
          ? contact.preferredName.trim()
          : typeof contact.name === 'string' ? contact.name.trim() : '';
        const email = optionalString(contact, 'email');
        const phone = optionalString(contact, 'phone');
        if (!preferredName || (!email && !phone) || action.object.serviceConsent !== true) {
          throw new BadRequestException('createSellerLeadDraft requires contact details and serviceConsent: true');
        }
        return this.sellerLeads.draft({
          profileId,
          contact: { preferredName, ...(email ? { email } : {}), ...(phone ? { phone } : {}) },
          serviceConsent: true,
        });
      }
      case 'rankSellerHouses':
        return this.sellerLeads.rankHouses({
          category: sellerComparisonCategory(requiredString(action.object, 'category'), ''),
          ...(optionalString(action.object, 'geography') ? { geography: optionalString(action.object, 'geography') } : {}),
          ...(optionalString(action.object, 'preferredLanguage') || optionalString(action.object, 'language')
            ? { preferredLanguage: optionalString(action.object, 'preferredLanguage') ?? optionalString(action.object, 'language') }
            : {}),
        });
      case 'rankAndStoreSellerHouses':
      case 'rankHousesForLead': {
        const leadId = requiredString(action.object, 'leadId');
        await this.requireOwnedLead(leadId, profileId);
        const ranking = this.sellerLeads.rankHouses({
          category: requiredString(action.object, 'category'),
          ...(optionalString(action.object, 'geography') ? { geography: optionalString(action.object, 'geography') } : {}),
          ...(optionalString(action.object, 'preferredLanguage') || optionalString(action.object, 'language')
            ? { preferredLanguage: optionalString(action.object, 'preferredLanguage') ?? optionalString(action.object, 'language') }
            : {}),
        });
        await this.sellerLeads.attachRanking(leadId, ranking);
        return ranking;
      }
      case 'chooseSellerHouse':
      case 'saveSellerHouseChoice': {
        const leadId = requiredString(action.object, 'leadId');
        await this.requireOwnedLead(leadId, profileId);
        return this.sellerLeads.saveSellerChoice(leadId, requiredString(action.object, 'houseId'));
      }
      case 'submitFinalSellerLead': {
        const leadId = requiredString(action.object, 'leadId');
        await this.requireOwnedLead(leadId, profileId);
        const nested = action.object.payload && typeof action.object.payload === 'object' && !Array.isArray(action.object.payload)
          ? action.object.payload as Record<string, unknown>
          : action.object;
        const parsed = submitSellerLeadSchema.safeParse({
          ...nested,
          valuation: nested.valuation ?? nested.valuationOrRefusal,
          evidence: nested.evidence ?? (Array.isArray(nested.evidenceIds)
            ? nested.evidenceIds.filter((id): id is string => typeof id === 'string').map((id) => ({ id, type: 'seller_statement' }))
            : undefined),
        });
        if (!parsed.success) throw new BadRequestException('submitFinalSellerLead payload is invalid');
        return this.sellerLeads.submitFinal(leadId, parsed.data);
      }
      case 'listSellerLeads': {
        const requestedProfileId = optionalString(action.object, 'profileId');
        if (requestedProfileId) this.requireSameProfile(requestedProfileId, profileId);
        return (await this.sellerLeads.list())
          .filter((lead) => lead.profileId === profileId)
          .map((lead) => this.safeLeadSummary(lead));
      }
      case 'getSellerLead': {
        const lead = await this.requireOwnedLead(requiredString(action.object, 'leadId'), profileId);
        return this.safeLeadDetail(lead);
      }
      case 'listEvidence': {
        const requestedProfileId = optionalString(action.object, 'profileId');
        if (requestedProfileId) this.requireSameProfile(requestedProfileId, profileId);
        if (!this.uploads) throw new BadRequestException('Evidence service is unavailable');
        return this.uploads.listEvidence(profileId, optionalString(action.object, 'itemId'));
      }
      case 'uploadEvidence': {
        const requestedProfileId = optionalString(action.object, 'profileId');
        if (requestedProfileId) this.requireSameProfile(requestedProfileId, profileId);
        const itemId = requiredString(action.object, 'itemId');
        return {
          status: 'client_action_required',
          method: 'POST',
          endpoint: `/api/evidence/${encodeURIComponent(profileId)}/items/${encodeURIComponent(itemId)}`,
          contentType: 'multipart/form-data',
          fieldName: 'files',
          note: 'The browser must attach the selected image file; file bytes are never sent through the AI workflow.',
        };
      }
      case 'getEvidenceFile': {
        const requestedProfileId = optionalString(action.object, 'profileId');
        if (requestedProfileId) this.requireSameProfile(requestedProfileId, profileId);
        if (!this.uploads) throw new BadRequestException('Evidence service is unavailable');
        const fileId = requiredString(action.object, 'fileId');
        const evidence = await this.uploads.listEvidence(profileId);
        const reference = evidence.find((row) => row.fileId === fileId);
        if (!reference) throw new NotFoundException('Evidence not found');
        return { fileId, previewUri: reference.previewUri, downloadUri: reference.downloadUri, mimeType: reference.mimeType };
      }
      case 'reorderEvidence': {
        const requestedProfileId = optionalString(action.object, 'profileId');
        if (requestedProfileId) this.requireSameProfile(requestedProfileId, profileId);
        if (!this.uploads) throw new BadRequestException('Evidence service is unavailable');
        const fileIds = action.object.fileIds;
        if (!Array.isArray(fileIds) || !fileIds.every((id) => typeof id === 'string')) {
          throw new BadRequestException('reorderEvidence requires fileIds as a string array');
        }
        return this.uploads.reorderEvidence(profileId, fileIds);
      }
      case 'deleteEvidence': {
        const requestedProfileId = optionalString(action.object, 'profileId');
        if (requestedProfileId) this.requireSameProfile(requestedProfileId, profileId);
        if (!this.uploads) throw new BadRequestException('Evidence service is unavailable');
        await this.uploads.deleteEvidence(profileId, requiredString(action.object, 'fileId'));
        return { success: true };
      }
    }
  }

  private requireSameProfile(requestedProfileId: string, profileId: string): void {
    if (requestedProfileId !== profileId) {
      throw new BadRequestException('Lead profileId must match the workflow profileId');
    }
  }

  private async requireOwnedLead(leadId: string, profileId: string) {
    const lead = (await this.sellerLeads.list()).find((candidate) => candidate.id === leadId && candidate.profileId === profileId);
    if (!lead || lead.profileId !== profileId) {
      throw new NotFoundException('Seller lead was not found');
    }
    return lead;
  }

  private safeLeadSummary(lead: Awaited<ReturnType<SellerLeadsService['get']>>) {
    return {
      leadId: lead.id,
      status: lead.status,
      createdAt: lead.createdAt.toISOString(),
      item: lead.item ? { id: lead.item.id, category: lead.item.category, title: lead.item.title } : null,
      recommendation: lead.recommendation?.recommendation?.house.name ?? null,
      sellerChoice: lead.sellerChoice?.houseName ?? null,
    };
  }

  private safeLeadDetail(lead: Awaited<ReturnType<SellerLeadsService['get']>>) {
    return {
      ...this.safeLeadSummary(lead),
      catalogDraft: lead.catalogDraft,
      enquiryText: lead.enquiryText,
      evidence: (lead.evidence ?? []).map(({ id, type }) => ({ id, type })),
      valuation: lead.valuation,
    };
  }
}
