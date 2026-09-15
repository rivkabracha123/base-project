import type { HouseRanking, SellerChoice } from '@monabid/shared';
import type { SellerLeadContact } from '../database/seller-lead.entity';

/**
 * S5 → P5 dashboard row.
 * Week 4 adds sellerChoice next to recommendation so P5 sees both “what S5 ranked” and “what the seller picked.”
 */
export interface SellerLeadSummary {
  id: string;
  profileId: string;
  contact: SellerLeadContact;
  recommendation: HouseRanking | null;
  sellerChoice: SellerChoice | null;
  createdAt: string;
}
