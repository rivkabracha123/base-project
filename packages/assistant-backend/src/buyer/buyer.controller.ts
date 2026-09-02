import { Body, Controller, Post } from '@nestjs/common';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerCriteria, P4FixtureResponse } from './buyer-criteria';

@Controller('buyer')
export class BuyerController {
  constructor(private readonly buyerCriteriaService: BuyerCriteriaService) {}

  @Post('extract')
  extractFromFixture(@Body() response: P4FixtureResponse): BuyerCriteria {
    return this.buyerCriteriaService.extractFromFixture(response);
  }
}
