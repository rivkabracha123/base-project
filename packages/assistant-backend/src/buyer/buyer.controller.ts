import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BuyerCriteriaService } from './buyer-criteria.service';
import {
  BuyerChatSystemMessage,
  BuyerChatTurnInput,
} from './buyer-chat-messages';
import { BuyerCriteria, AiExtractResponse } from './buyer-criteria';

@Controller('buyer')
export class BuyerController {
  constructor(private readonly buyerCriteriaService: BuyerCriteriaService) {}

  @Post('extract')
  startCriteriaSession(@Body() aiResponse: AiExtractResponse): BuyerChatSystemMessage {
    return this.buyerCriteriaService.startCriteriaSessionFromAiResponse(aiResponse);
  }

  @Post('criteria/turn')
  continueCriteriaSession(@Body() request: BuyerChatTurnInput): BuyerChatSystemMessage {
    return this.buyerCriteriaService.continueCriteriaSessionFromChat(request);
  }

  @Get('sessions/:sessionId/criteria')
  getCriteriaForSession(@Param('sessionId') sessionId: string): BuyerCriteria {
    return this.buyerCriteriaService.getCriteriaForSession(sessionId);
  }
}
