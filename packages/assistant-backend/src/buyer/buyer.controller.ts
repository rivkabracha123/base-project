import { Body, Controller, Post } from '@nestjs/common';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerCriteriaResponse, BuyerCriteriaTurnRequest, P4FixtureResponse } from './buyer-criteria';

@Controller('buyer')
export class BuyerController {
  constructor(private readonly buyerCriteriaService: BuyerCriteriaService) {}

  @Post('extract')
  extractFromFixture(@Body() response: P4FixtureResponse): BuyerCriteriaResponse {
    return this.buyerCriteriaService.extractFromFixture(response);
  }

  @Post('criteria/turn')
  processCriteriaTurn(@Body() request: BuyerCriteriaTurnRequest): BuyerCriteriaResponse {
    return this.buyerCriteriaService.processTurn(request);
  }
}
