import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class StaffOperationsService {
  constructor(
    @InjectRepository(StaffOperationEntity)
    private readonly staffOpRepository: Repository<StaffOperationEntity>,
    @Inject(BUYER_LEAD_DASHBOARD_SOURCE)
    private readonly buyerLeadDashboardSource: BuyerLeadDashboardSource,
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

  private limitContactToServiceConsent(contact: DashboardBuyerLeadContact): DashboardBuyerLeadContact {
    if (contact.serviceConsent.granted) return contact;
    return { ...contact, email: null, phone: null };
  }
}
