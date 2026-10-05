import { isBuyerHandoffContract } from './buyer-handoff';
import { FixtureProviderService } from './fixture-provider.service';

//test suite for the buyer handoff contract validation
describe('BuyerHandoffContract', () => {
  it('accepts the fixture output that is handed to buyer consumers', async () => {
    const result = await new FixtureProviderService().generate({
      prompt: 'טבעת כחולה משנת 2021',
      language: 'he',
    });

    expect(isBuyerHandoffContract(result.structuredAnswer)).toBe(true);
  });

//test Checks that a malformed buyer answer structure is rejected before being passed forward 
  it('rejects a handoff with a non-string keyword', () => {
    expect(
      isBuyerHandoffContract({
        language: 'en',
        intent: 'Find a ring',
        category: 'rings',
        keywords: ['ring', 5000],
        hasContactDetails: false,
        hasImages: false,
      }),
    ).toBe(false);
  });
});