import { appliedRelaxations, relaxCriteriaForSearch, relaxationOptions } from './approved-relaxation';
import { emptyBuyerCriteria } from './buyer-criteria';

const approvedAt = '2026-10-06T10:00:00.000Z';

// Criteria carrying every filter the lots search supports, with budget.
const fullCriteria = () => ({
  ...emptyBuyerCriteria('en'),
  categories: ['rare_books'],
  creators: ['Yitzhak Abrabanel'],
  auctionHouseIds: ['kestenbaum'],
  dateRange: { from: '1990-01-01' },
  price: { min: 1000, max: 1500, currency: 'USD' },
  keywords: ['manuscript'],
});

describe('approved relaxation', () => {
  it('offers only active filters, each requiring approval, with budget last', () => {
    expect(relaxationOptions(fullCriteria())).toEqual([
      { field: 'dateRange', requiresApproval: true },
      { field: 'auctionHouseIds', requiresApproval: true },
      { field: 'creators', requiresApproval: true },
      { field: 'categories', requiresApproval: true },
      { field: 'price', requiresApproval: true },
    ]);
    expect(relaxationOptions({ ...emptyBuyerCriteria('en'), keywords: ['manuscript'] })).toEqual([]);
  });

  it('offers periods, places and media only when a value of theirs was sent', () => {
    const criteria = {
      ...emptyBuyerCriteria('he'),
      periods: ['1890'],
      geography: ['ישראל'],
      media: ['painting'],
    };

    expect(relaxationOptions(criteria)).toEqual([
      { field: 'periods', requiresApproval: true },
      { field: 'media', requiresApproval: true },
    ]);
    expect(relaxCriteriaForSearch(criteria, ['periods']).periods).toEqual([]);
    expect(criteria.periods).toEqual(['1890']);
  });

  it('relaxes nothing, budget included, without an explicit approval', () => {
    expect(appliedRelaxations(fullCriteria())).toEqual([]);
    expect(appliedRelaxations(fullCriteria(), [])).toEqual([]);
  });

  it('applies only approved filters that are actually active', () => {
    const criteria = { ...emptyBuyerCriteria('en'), categories: ['rare_books'] };

    expect(
      appliedRelaxations(criteria, [
        { field: 'price', approvedAt },
        { field: 'categories', approvedAt },
      ]),
    ).toEqual(['categories']);
  });

  it('drops approved filters from a copy only, leaving the buyer criteria and budget intact', () => {
    const criteria = fullCriteria();
    const searchCriteria = relaxCriteriaForSearch(criteria, ['creators', 'price']);

    expect(searchCriteria.creators).toEqual([]);
    expect(searchCriteria.price).toBeUndefined();
    expect(searchCriteria.categories).toEqual(['rare_books']);
    expect(searchCriteria.keywords).toEqual(['manuscript']);
    expect(criteria).toEqual(fullCriteria());
  });
});
