// Shared type definitions and schemas used across all packages
// These are consumed by the backend (NestJS), client (React), and tests

// Auction lot types: read-only catalog data from auction houses
export * from './auction-lot';

// Seller item draft types: the contract for Week 2 seller-intake flow
// Includes Zod schemas for validation, TypeScript types, and documented field meanings
export * from './seller-item-draft';
export * from './comparable';
export * from './house-recommendation';
export * from './s5-demo-fixtures';
export {
  dashboardValuationSchema,
  dashboardValuationSourceSchema,
  sellerLeadValuationSnapshotSchema,
  type DashboardValuationDto,
  type DashboardValuationSource,
  type SellerLeadValuationSnapshot,
} from './dashboard-valuation';
export * from './user-profile';
export * from './profile-contact-snapshot';
export * from './p3-current-profile';
export * from './s1-seller-handoff';
export * from './seller-enquiry-events';
export * from './valuation-history';
