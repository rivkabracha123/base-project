import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { submitSellerLeadSchema } from '@monabid/shared';
import { SELLER_INTAKE_AI_PROVIDER, type SellerIntakeAiProvider } from '../seller-intake/seller-intake-ai.provider';
import { SellerLeadsService } from '../seller-leads/seller-leads.service';
import { toSellerLeadDashboardDetail } from '../seller-leads/seller-lead-dashboard';
import { UploadsService } from '../uploads/uploads.service';
import type { SellerFunctionName, SellerFunctionResponse, SellerWorkflowRequest, SellerWorkflowResult, SellerWorkflowResultCallback } from './seller-workflow.types';

const SELLER_FUNCTIONS = new Set<SellerFunctionName>([
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
          category: requiredString(action.object, 'category'),
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
      evidence: (lead.evidence ?? []).map(({ id, type }) => ({ id, type })),
      valuation: lead.valuation,
    };
  }
}