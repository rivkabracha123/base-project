import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BuyerCriteriaService } from './buyer-criteria.service';
import {
  BuyerChatSystemMessage,
  BuyerChatTurnInput,
} from './buyer-chat-api';
import { BuyerCriteria, UpstreamHandoffResponse } from './buyer-criteria';

@Controller('buyer')
export class BuyerController {
  constructor(private readonly buyerCriteriaService: BuyerCriteriaService) {}

  @Post('extract')
  startCriteriaSession(@Body() handoff: UpstreamHandoffResponse): BuyerChatSystemMessage {
    return this.buyerCriteriaService.startCriteriaSessionFromHandoff(handoff);
  }

  @Post('criteria/turn')
  continueCriteriaSession(@Body() request: BuyerChatTurnInput): BuyerChatSystemMessage {
    return this.buyerCriteriaService.continueCriteriaSessionFromChatTurn(request);
  }

  @Get('sessions/:sessionId/criteria')
  getCriteriaForSession(@Param('sessionId') sessionId: string): BuyerCriteria {
    return this.buyerCriteriaService.getCriteriaForSession(sessionId);
  }
}
