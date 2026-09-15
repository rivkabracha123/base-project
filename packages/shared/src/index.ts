// Shared type definitions and schemas used across all packages
// These are consumed by the backend (NestJS), client (React), and tests

// Auction lot types: read-only catalog data from auction houses
export * from './auction-lot';
export * from './user-profile';

// Seller item draft types: the contract for Week 2 seller-intake flow
// Includes Zod schemas for validation, TypeScript types, and documented field meanings
export * from './seller-item-draft';
export * from './comparable';
export * from './house-recommendation';
