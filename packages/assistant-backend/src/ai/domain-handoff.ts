import type { BuyerHandoffContract } from './buyer-handoff';
import type { SellerHandoffContract } from './seller-handoff';

export type BuyerDomainHandoff = {
  target: 'B2';
  extraction: BuyerHandoffContract;
};

export type SellerDomainHandoff = {
  target: 'S1';
  extraction: SellerHandoffContract;
};

export type DomainHandoff = BuyerDomainHandoff | SellerDomainHandoff;

export function createDomainHandoff(
  extraction: BuyerHandoffContract | SellerHandoffContract,
): DomainHandoff {
  return extraction.role === 'buyer'
    ? { target: 'B2', extraction }
    : { target: 'S1', extraction };
}