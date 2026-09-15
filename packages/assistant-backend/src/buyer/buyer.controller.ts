import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BuyerCriteriaService } from './buyer-criteria.service';
import {
  BuyerCriteriaB1Response,
  BuyerCriteriaTurnRequest,
} from './buyer-b1-contract';
import { BuyerCriteria, P4FixtureResponse } from './buyer-criteria';

@Controller('buyer')
export class BuyerController {
  constructor(private readonly buyerCriteriaService: BuyerCriteriaService) {}

  @Post('extract')
  extractFromFixture(@Body() response: P4FixtureResponse): BuyerCriteriaB1Response {
    return this.buyerCriteriaService.extractFromFixture(response);
  }

  @Post('criteria/turn')
  processCriteriaTurn(@Body() request: BuyerCriteriaTurnRequest): BuyerCriteriaB1Response {
    return this.buyerCriteriaService.processTurn(request);
  }

  @Get('sessions/:sessionId/criteria')
  getCriteriaForSession(@Param('sessionId') sessionId: string): BuyerCriteria {
    return this.buyerCriteriaService.getCriteriaForSession(sessionId);
  }
}
