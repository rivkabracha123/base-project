import { Body, Controller, Post } from '@nestjs/common';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerCriteriaResponse, P4FixtureResponse } from './buyer-criteria';

@Controller('buyer')
export class BuyerController {
  constructor(private readonly buyerCriteriaService: BuyerCriteriaService) {}

  @Post('extract')
  extractFromFixture(@Body() response: P4FixtureResponse): BuyerCriteriaResponse {
    return this.buyerCriteriaService.extractFromFixture(response);
  }
}
