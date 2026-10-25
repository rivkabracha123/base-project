import { Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffOperationEntity } from '../database/staff-operation.entity';
import { StaffOperationListItem } from './staff-operation-list-item';
import {
  BUYER_LEAD_DASHBOARD_SOURCE,
  BuyerLeadDashboardSource,
  DashboardBuyerLeadContact,
} from './buyer-lead-dashboard-source';
import { StaffBuyerLeadDetail } from './staff-buyer-lead-detail';
import { StaffSellerLeadDetail } from './staff-seller-lead-detail';
import {
  DashboardSellerLeadContact,
  SELLER_LEAD_DASHBOARD_SOURCE,
  SellerLeadDashboardSource,
} from './seller-lead-dashboard-source';
import {
  assertValidPipelineTransition,
  normalizePipelineStatus,
  StaffLeadPipeline,
  StaffPipelineStatus,
  UpdateStaffLeadPipelineInput,
} from './staff-lead-pipeline';

// Existing synthetic rows predate the category field. Keep their demonstration
// metadata usable while new and updated rows supply it through payload instead.
const legacySyntheticLeadCategories: Record<string, string> = {
  'buyer-lead-001': 'rare_hebrew_manuscript',
  'buyer-lead-002': 'rare_hebrew_manuscript',
  'lead-1': 'judaica',
  'lead-3': 'rare_books',
  'lead-4': 'judaica',
};

@Injectable()
export class StaffOperationsService {
  constructor(
    @InjectRepository(StaffOperationEntity)
    private readonly staffOpRepository: Repository<StaffOperationEntity>,
    @Inject(BUYER_LEAD_DASHBOARD_SOURCE)
    private readonly buyerLeadDashboardSource: BuyerLeadDashboardSource,
    @Optional()
    @Inject(SELLER_LEAD_DASHBOARD_SOURCE)
    private readonly sellerLeadDashboardSource?: SellerLeadDashboardSource,
  ) {}

  async findAll(): Promise<StaffOperationListItem[]> {
    const leads = await this.staffOpRepository.find({ order: { createdAt: 'DESC' } });
    const buyerLeads = await this.buyerLeadDashboardSource.listBuyerLeads?.();

    // A live Buyer source owns all buyer rows. Retaining legacy buyer entities
    // alongside it would show stale synthetic leads and could expose stale data.
    const repositoryLeads = buyerLeads ? leads.filter((lead) => lead.type === 'seller') : leads;
    const safeRepositoryLeads = repositoryLeads.map((lead) => this.toSafeListItem(lead));
    const safeBuyerLeads = buyerLeads?.map(({ id, type, clientName, status, category, requestDetails, createdAt, pipelineAvailable }) => ({
      id, type, clientName, status, ...(category ? { category } : {}), requestDetails, createdAt,
      ...(pipelineAvailable === false ? { pipelineAvailable: false } : {}),
    })) ?? [];

    return [...safeBuyerLeads, ...safeRepositoryLeads]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async getBuyerLeadDetail(leadId: string): Promise<StaffBuyerLeadDetail> {
    const staffLead = await this.staffOpRepository.findOneBy({ id: leadId });
    if (staffLead && staffLead.type !== 'buyer') throw new NotFoundException('Buyer lead not found');

    const lead = await this.buyerLeadDashboardSource.getBuyerLead(leadId);
    if (!lead) throw new NotFoundException('Buyer lead not found');

    const contact = this.limitContactToServiceConsent(lead.contact);
    if (lead.outcome.kind === 'results') {
      return {
        id: lead.id ?? staffLead?.id ?? leadId,
        type: 'buyer',
        status: lead.status ?? staffLead?.status ?? 'new',
        criteria: lead.outcome.searchRequest.criteria,
        hardConstraints: lead.outcome.searchRequest.hardConstraints,
        results: [
          ...lead.outcome.groupedItems.current.map(({ id }) => ({ id, group: 'current' as const })),
          ...lead.outcome.groupedItems.historical.map(({ id }) => ({ id, group: 'historical' as const })),
        ],
        unmatchedDemand: null,
        contact,
      };
    }

    const demand = lead.outcome.view.unmatchedDemand;
    return {
      id: lead.id ?? staffLead?.id ?? leadId,
      type: 'buyer',
      status: lead.status ?? staffLead?.status ?? 'new',
      criteria: demand.searchRequest.criteria,
      hardConstraints: demand.searchRequest.hardConstraints,
      results: [],
      unmatchedDemand: {
        reason: demand.reason,
        originalCriteria: demand.searchRequest.criteria,
      },
      contact,
    };
  }

  async getLeadDetail(leadId: string): Promise<StaffBuyerLeadDetail | StaffSellerLeadDetail> {
    const staffLead = await this.staffOpRepository.findOneBy({ id: leadId });
    return staffLead?.type === 'seller'
      ? this.getSellerLeadDetail(leadId)
      : this.getBuyerLeadDetail(leadId);
  }

  async getSellerLeadDetail(leadId: string): Promise<StaffSellerLeadDetail> {
    const staffLead = await this.staffOpRepository.findOneBy({ id: leadId });
    if (!staffLead || staffLead.type !== 'seller') throw new NotFoundException('Seller lead not found');
    if (!this.sellerLeadDashboardSource) throw new ServiceUnavailableException('Seller lead source is unavailable');

    const lead = await this.sellerLeadDashboardSource.getSellerLead(leadId);
    if (!lead) throw new NotFoundException('Seller lead not found');

    return {
      id: staffLead.id,
      type: 'seller',
      status: lead.status,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      item: lead.item,
      evidence: lead.evidence.map(({ id, type }) => ({ id, type })),
      comparables: lead.comparables.map(({ id, source }) => ({ id, ...(source ? { source } : {}) })),
      valuation: lead.valuation,
      recommendation: lead.recommendation,
      alternatives: lead.alternatives,
      sellerChoice: lead.sellerChoice,
      catalogDraft: lead.catalogDraft,
      enquiryText: lead.enquiryText,
      contact: this.limitSellerContactToServiceConsent(lead.contact),
      history: lead.history.map(({ at, event, actor }) => ({ at, event, actor })),
    };
  }

  private limitContactToServiceConsent(contact: DashboardBuyerLeadContact): DashboardBuyerLeadContact {
    if (contact.serviceConsent.granted) return contact;
    return { ...contact, email: null, phone: null };
  }

  private limitSellerContactToServiceConsent(contact: DashboardSellerLeadContact): DashboardSellerLeadContact {
    if (contact.serviceConsentGranted) return contact;
    return { ...contact, email: null, phone: null };
  }

  async getPipeline(leadId: string): Promise<StaffLeadPipeline> {
    const lead = await this.staffOpRepository.findOneBy({ id: leadId });
    if (!lead) throw new NotFoundException('Staff lead not found');
    return this.readPipeline(lead.status, lead.createdAt, lead.payload);
  }

  async updatePipeline(leadId: string, update: UpdateStaffLeadPipelineInput): Promise<StaffLeadPipeline> {
    const lead = await this.staffOpRepository.findOneBy({ id: leadId });
    if (!lead) throw new NotFoundException('Staff lead not found');
    if (update.status === undefined && update.nextAction === undefined && update.note === undefined) {
      throw new Error('A pipeline update is required');
    }

    const currentStatus = normalizePipelineStatus(lead.status);
    const pipeline = this.readPipeline(lead.status, lead.createdAt, lead.payload);
    const nextStatus = update.status ?? currentStatus;
    if (update.status !== undefined) {
      assertValidPipelineTransition(currentStatus, update.status);
      pipeline.statusHistory.push({ at: new Date().toISOString(), from: currentStatus, to: update.status });
    }

    if (update.nextAction !== undefined) {
      pipeline.nextAction = update.nextAction?.trim() || null;
    }
    if (update.note !== undefined) {
      const text = update.note.trim();
      if (!text) throw new Error('Activity note cannot be empty');
      pipeline.activityNotes.push({ at: new Date().toISOString(), text });
    }
    pipeline.status = nextStatus;

    await this.staffOpRepository.save({
      ...lead,
      status: nextStatus,
      payload: { ...lead.payload, staffPipeline: pipeline },
    });
    return pipeline;
  }

  /** Category is safe list metadata; never expose the rest of the opaque payload. */
  private toSafeListItem({ id, type, clientName, status, requestDetails, createdAt, payload }: StaffOperationEntity): StaffOperationListItem {
    const category = this.findSafeCategory(payload) ?? legacySyntheticLeadCategories[id];
    return {
      id,
      type,
      clientName,
      status,
      ...(category ? { category } : {}),
      requestDetails,
      createdAt,
    };
  }

  private findSafeCategory(payload: Record<string, unknown>): string | undefined {
    const asRecord = (value: unknown): Record<string, unknown> | undefined => (
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined
    );
    const criteria = asRecord(payload.criteria) ?? asRecord(asRecord(payload.searchRequest)?.criteria);
    const candidates = [payload.category, criteria?.category, asRecord(payload.item)?.category];
    return candidates.find((category): category is string => typeof category === 'string' && category.length > 0);
  }

  private readPipeline(status: string, createdAt: Date, payload: Record<string, unknown>): StaffLeadPipeline {
    const stored = payload.staffPipeline;
    const pipeline = typeof stored === 'object' && stored !== null && !Array.isArray(stored)
      ? stored as Partial<StaffLeadPipeline>
      : {};
    const currentStatus = normalizePipelineStatus(status);
    const statusHistory = Array.isArray(pipeline.statusHistory) ? pipeline.statusHistory : [
      { at: createdAt.toISOString(), from: null, to: currentStatus },
    ];
    const activityNotes = Array.isArray(pipeline.activityNotes) ? pipeline.activityNotes : [];
    return {
      status: currentStatus,
      nextAction: typeof pipeline.nextAction === 'string' ? pipeline.nextAction : null,
      statusHistory: statusHistory as StaffLeadPipeline['statusHistory'],
      activityNotes: activityNotes as StaffLeadPipeline['activityNotes'],
    };
  }
}
