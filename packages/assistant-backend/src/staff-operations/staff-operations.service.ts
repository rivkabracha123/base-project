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

    // Do not expose private domain data through the dashboard.
    return leads.map(({ id, type, clientName, status, requestDetails, createdAt }) => ({
      id,
      type,
      clientName,
      status,
      requestDetails,
      createdAt,
    }));
  }

  async getBuyerLeadDetail(leadId: string): Promise<StaffBuyerLeadDetail> {
    const staffLead = await this.staffOpRepository.findOneBy({ id: leadId });
    if (!staffLead || staffLead.type !== 'buyer') throw new NotFoundException('Buyer lead not found');

    const lead = await this.buyerLeadDashboardSource.getBuyerLead(leadId);
    if (!lead) throw new NotFoundException('Buyer lead not found');

    const contact = this.limitContactToServiceConsent(lead.contact);
    if (lead.outcome.kind === 'results') {
      return {
        id: staffLead.id,
        type: 'buyer',
        status: staffLead.status,
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
      id: staffLead.id,
      type: 'buyer',
      status: staffLead.status,
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
    if (!staffLead) throw new NotFoundException('Staff lead not found');

    return staffLead.type === 'buyer'
      ? this.getBuyerLeadDetail(leadId)
      : this.getSellerLeadDetail(leadId);
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
}
