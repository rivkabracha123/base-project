import { Inject, Injectable } from '@nestjs/common';
import { UnmatchedDemandDbStore } from '../buyer/unmatched-demand.db-store';
import type {
  BuyerLeadDashboardSource,
  DashboardBuyerLeadListRecord,
  DashboardBuyerLeadSourceRecord,
} from './buyer-lead-dashboard-source';

/**
 * Adapts Buyer-owned unmatched demand into the privacy-safe port consumed by
 * Staff Operations. The Buyer view intentionally contains no contact data.
 */
@Injectable()
export class UnmatchedDemandBuyerLeadDashboardSource implements BuyerLeadDashboardSource {
  constructor(
    @Inject(UnmatchedDemandDbStore)
    private readonly unmatchedDemandStore: Pick<UnmatchedDemandDbStore, 'get' | 'list'>,
  ) {}

  async getBuyerLead(leadId: string): Promise<DashboardBuyerLeadSourceRecord | undefined> {
    const demand = await this.unmatchedDemandStore.get(leadId);
    return demand ? this.toDashboardLead(demand) : undefined;
  }

  async listBuyerLeads(): Promise<DashboardBuyerLeadListRecord[]> {
    const demands = await this.unmatchedDemandStore.list();
    return demands.map((demand) => this.toDashboardLead(demand));
  }

  private toDashboardLead(demand: Awaited<ReturnType<UnmatchedDemandDbStore['get']>> & {}): DashboardBuyerLeadListRecord {
    const { searchRequest } = demand.unmatchedDemand;
    return {
      id: demand.id,
      type: 'buyer',
      status: demand.status,
      clientName: 'Anonymous Demand',
      requestDetails: 'No matching result for the buyer request.',
      category: this.findCategory(searchRequest.criteria),
      createdAt: new Date(demand.createdAt),
      pipelineAvailable: false,
      outcome: {
        kind: 'unmatched',
        view: {
          ...demand,
          unmatchedDemand: {
            ...demand.unmatchedDemand,
            // The dashboard port accepts generic JSON criteria. Copy the
            // typed Buyer criteria into a plain, safe-to-render object.
            searchRequest: {
              ...searchRequest,
              criteria: { ...searchRequest.criteria },
            },
          },
        },
      },
      contact: {
        preferredName: null,
        email: null,
        phone: null,
        followUpStatus: 'contact_missing',
        serviceConsent: { granted: false },
      },
    };
  }

  private findCategory(criteria: { categories?: unknown; category?: unknown }): string | undefined {
    const categories = criteria.categories;
    if (Array.isArray(categories) && typeof categories[0] === 'string') return categories[0];
    return typeof criteria.category === 'string' ? criteria.category : undefined;
  }
}
