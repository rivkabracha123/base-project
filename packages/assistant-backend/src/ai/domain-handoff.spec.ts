import { createDomainHandoff } from './domain-handoff';
//test suite for the domain handoff creation
describe('createDomainHandoff', () => {
  it('routes buyer extraction to B2', () => {
    const extraction = {
      role: 'buyer' as const,
      language: 'he' as const,
      intent: 'Find a painting',
      category: 'paintings',
      hasContactDetails: false,
      hasImages: false,
    };

    expect(createDomainHandoff(extraction)).toEqual({
      target: 'B2',
      extraction,
    });
  });
//test that seller extraction is routed to S1
  it('routes seller extraction to S1', () => {
    const extraction = {
      role: 'seller' as const,
      language: 'he' as const,
      intent: 'Prepare an item for auction review.',
      category: 'paintings',
      item: {},
      missingFacts: ['dimensions'],
      confirmedFacts: [],
      uncertainFacts: [],
      sellerConfirmation: { required: true, status: 'pending' as const },
      hasContactDetails: false,
      hasImages: false,
    };

    expect(createDomainHandoff(extraction)).toEqual({
      target: 'S1',
      extraction,
    });
  });
});