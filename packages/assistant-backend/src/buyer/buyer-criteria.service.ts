import { Injectable } from '@nestjs/common';
import {
  BuyerCriteriaResponse,
  BuyerCriteriaTurnRequest,
  P4FixtureResponse,
  extractBuyerCriteriaFromFixture,
  processCriteriaTurn,
} from './buyer-criteria';

@Injectable()
export class BuyerCriteriaService {
  extractFromFixture(response: P4FixtureResponse): BuyerCriteriaResponse {
    return extractBuyerCriteriaFromFixture(response);
  }

  processTurn(request: BuyerCriteriaTurnRequest): BuyerCriteriaResponse {
    return processCriteriaTurn(request);
  }
}
