import type { LotFiltersDto } from '../lots/lot-search.dto';
import type { SearchFilters } from './search-request';

// Every filter the buyer search sends must be one the lots search accepts. `statuses`
// is the only lots-search filter not sent yet: the buyer criteria do not carry it.
type NotInTheDto = Exclude<keyof SearchFilters, keyof LotFiltersDto>;
type NotSent = Exclude<keyof LotFiltersDto, keyof SearchFilters>;
const inSync: [NotInTheDto, NotSent] extends [never, 'statuses'] ? true : never = true;

describe('search filters', () => {
  it('send only filters the lots search accepts', () => {
    expect(inSync).toBe(true);
  });
});
