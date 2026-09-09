import type { HouseRanking } from '@monabid/shared';
import type { SellerLeadContact } from '../database/seller-lead.entity';

/**
 * The dashboard-facing shape of a seller enquiry.
 *
 * Week 3 adds fixture-backed house ranking. Seller choice, catalog draft,
 * valuation, and history join in later weeks without this recommendation
 * overwriting a seller choice (choice is not stored yet).
 */
export interface SellerLeadSummary {
  id: string;
  profileId: string;
  contact: SellerLeadContact;
  recommendation: HouseRanking | null;
  createdAt: string;
}
