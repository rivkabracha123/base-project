import { Injectable } from '@nestjs/common';
import { BuyerCriteria, P4FixtureResponse, extractBuyerCriteriaFromFixture, mergeBuyerCriteria } from './buyer-criteria';

@Injectable()
export class BuyerCriteriaService {
  extractFromFixture(response: P4FixtureResponse): BuyerCriteria {
    return extractBuyerCriteriaFromFixture(response);
  }

  merge(existing: BuyerCriteria, update: Partial<BuyerCriteria>): BuyerCriteria {
    return mergeBuyerCriteria(existing, update);
  }
}
