import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SELLER_INTAKE_AI_PROVIDER, type SellerIntakeAiProvider } from '../seller-intake/seller-intake-ai.provider';
import { SellerLeadsService } from '../seller-leads/seller-leads.service';
import type { SellerFunctionResponse, SellerWorkflowRequest, SellerWorkflowResult, SellerWorkflowResultCallback } from './seller-workflow.types';

@Injectable()
export class SellerWorkflowService {
  constructor(
    @Inject(SELLER_INTAKE_AI_PROVIDER) private readonly sellerIntakeAi: SellerIntakeAiProvider,
    private readonly sellerLeads: SellerLeadsService,
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

    const object = value.object as Record<string, unknown>;
    const requiredString = (key: string): string => {
      const field = object[key];
      if (typeof field !== 'string' || !field.trim()) {
        throw new BadRequestException(`${String(value.functionToRun)} requires ${key}`);
      }
      return field;
    };

    switch (value.functionToRun) {
      case 'analyzeSellerIntake':
        return { functionToRun: 'analyzeSellerIntake', object: { input: requiredString('input') } };
      case 'createSellerLead': {
        const contactValue = object.contact;
        if (typeof contactValue !== 'object' || contactValue === null || Array.isArray(contactValue)) {
          throw new BadRequestException('createSellerLead requires contact');
        }
        const contact = contactValue as Record<string, unknown>;
        if (typeof contact.preferredName !== 'string' || !contact.preferredName.trim()
          || (typeof contact.email !== 'string' && typeof contact.phone !== 'string')
          || object.serviceConsent !== true) {
          throw new BadRequestException('createSellerLead requires contact details and serviceConsent: true');
        }
        return {
          functionToRun: 'createSellerLead',
          object: {
            profileId: requiredString('profileId'),
            contact: {
              preferredName: contact.preferredName,
              ...(typeof contact.email === 'string' ? { email: contact.email } : {}),
              ...(typeof contact.phone === 'string' ? { phone: contact.phone } : {}),
            },
            serviceConsent: true,
          },
        };
      }
      case 'rankHousesForLead': {
        const geography = object.geography;
        const preferredLanguage = object.preferredLanguage;
        if ((geography !== undefined && typeof geography !== 'string')
          || (preferredLanguage !== undefined && typeof preferredLanguage !== 'string')) {
          throw new BadRequestException('rankHousesForLead has invalid optional fields');
        }
        return {
          functionToRun: 'rankHousesForLead',
          object: {
            leadId: requiredString('leadId'),
            category: requiredString('category'),
            ...(typeof geography === 'string' ? { geography } : {}),
            ...(typeof preferredLanguage === 'string' ? { preferredLanguage } : {}),
          },
        };
      }
      case 'saveSellerHouseChoice':
        return {
          functionToRun: 'saveSellerHouseChoice',
          object: { leadId: requiredString('leadId'), houseId: requiredString('houseId') },
        };
      default:
        throw new BadRequestException('Shilat requested a seller function outside the agreed contract');
    }
  }

  private async dispatch(
    action: SellerFunctionResponse,
    profileId: string,
  ): Promise<unknown> {
    switch (action.functionToRun) {
      case null:
        return null;
      case 'analyzeSellerIntake':
        return this.sellerIntakeAi.analyze(action.object.input);
      case 'createSellerLead':
        if (action.object.profileId !== profileId) {
          throw new BadRequestException('Lead profileId must match the workflow profileId');
        }
        return this.sellerLeads.draft(action.object);
      case 'rankHousesForLead': {
        await this.requireOwnedLead(action.object.leadId, profileId);
        const ranking = this.sellerLeads.rankHouses({
          category: action.object.category,
          ...(action.object.geography ? { geography: action.object.geography } : {}),
          ...(action.object.preferredLanguage ? { preferredLanguage: action.object.preferredLanguage } : {}),
        });
        await this.sellerLeads.attachRanking(action.object.leadId, ranking);
        return ranking;
      }
      case 'saveSellerHouseChoice':
        await this.requireOwnedLead(action.object.leadId, profileId);
        return this.sellerLeads.saveSellerChoice(action.object.leadId, action.object.houseId);
    }
  }

  private async requireOwnedLead(leadId: string, profileId: string): Promise<void> {
    const lead = (await this.sellerLeads.list()).find((candidate) => candidate.id === leadId);
    if (!lead || lead.profileId !== profileId) {
      throw new NotFoundException('Seller lead was not found');
    }
  }
}