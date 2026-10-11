import { MATCH_REASON_FIELDS, type MatchReasonField } from '@monabid/shared';
import type { LotFiltersDto } from './lot-search.dto';

// Every filter a request can carry, plus the free-text `query`, must be a field a
// reason can name, and the shared list must not name anything else. A filter added
// to the DTO without updating the shared list (or the other way round) stops this
// file from compiling.
type MissingFromList = Exclude<keyof LotFiltersDto | 'query', MatchReasonField>;
type NotInTheDto = Exclude<MatchReasonField, keyof LotFiltersDto | 'query'>;
const inSync: [MissingFromList, NotInTheDto] extends [never, never] ? true : never = true;

describe('match reason fields', () => {
  it('name exactly the request filters plus the free text', () => {
    expect(inSync).toBe(true);
    expect(new Set(MATCH_REASON_FIELDS).size).toBe(MATCH_REASON_FIELDS.length);
  });
});
