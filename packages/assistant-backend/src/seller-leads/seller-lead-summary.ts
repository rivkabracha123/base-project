import type { SellerLeadContact } from '../database/seller-lead.entity';

/**
 * The dashboard-facing shape of a draft seller enquiry.
 *
 * Week 2 publishes only what a draft can support. Item, evidence, valuation,
 * recommendation, alternatives, seller choice, catalog draft, status, and
 * history join the shape in later weeks, once their owners define them.
 */
export interface SellerLeadSummary {
  id: string;
  profileId: string;
  contact: SellerLeadContact;
  createdAt: string;
}
