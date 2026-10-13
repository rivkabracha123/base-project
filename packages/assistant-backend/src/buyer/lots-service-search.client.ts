import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { LotSearchDto } from '../lots/lot-search.dto';
import { LotsService } from '../lots/lots.service';
import type { LotsSearchClient } from './buyer-search.orchestrator';
import type { LotSearchResult } from '../lots/lot-match';
import type { SearchRequest } from './search-request';

const DEFAULT_SEARCH_LIMIT = 50;

// Thrown when a request breaks the lots search's own DTO rules; names the fields only, never their values.
export class InvalidLotsSearchRequestError extends Error {
  constructor(readonly fields: string[]) {
    super(`Lots search request rejected: invalid ${fields.join(', ')}`);
    this.name = 'InvalidLotsSearchRequestError';
  }
}

// Flattens nested DTO validation errors into dotted field paths (e.g. "filters.price.min").
function invalidFields(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    return error.children?.length ? invalidFields(error.children, path) : [path];
  });
}

/** POST /api/lots/search via LotsService (P2), validated by the same LotSearchDto the HTTP route uses. */
@Injectable()
export class LotsServiceSearchClient implements LotsSearchClient {
  constructor(private readonly lots: LotsService) {}

  async search(request: SearchRequest): Promise<LotSearchResult> {
    const body = {
      query: request.query,
      language: request.language,
      page: 1,
      limit: DEFAULT_SEARCH_LIMIT,
      filters: request.filters,
    };
    const errors = await validate(plainToInstance(LotSearchDto, body));
    if (errors.length > 0) throw new InvalidLotsSearchRequestError(invalidFields(errors));
    return this.lots.search(body);
  }
}
