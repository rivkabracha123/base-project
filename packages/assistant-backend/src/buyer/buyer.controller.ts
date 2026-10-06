import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { P4AiGenerateRequest } from '../ai/p4-ai.types';
import { P4AiGenerateClient } from '../ai/p4-ai-generate.client';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerP4BridgeService } from './buyer-p4-bridge.service';
import { BuyerSessionSearchService } from './buyer-session-search.service';
import type { P4BuyerAiContext } from '../ai/p4-ai.types';
import type { OpenBuyerConversationRequest } from './buyer-conversation.dto';
import {
  BuyerChatSystemMessage,
  BuyerChatTurnInput,
} from './buyer-chat-messages';
import { BuyerCriteria, AiExtractResponse } from './buyer-criteria';

@Controller('buyer')
export class BuyerController {
  constructor(
    private readonly buyerCriteriaService: BuyerCriteriaService,
    private readonly buyerSessionSearchService: BuyerSessionSearchService,
    private readonly buyerP4BridgeService: BuyerP4BridgeService,
    private readonly p4AiGenerateClient: P4AiGenerateClient,
  ) {}

  /** P4 bridge: buyer message → /ai/generate → criteria session (preferred over raw POST /extract). */
  @Post('conversation/open')
  openConversation(@Body() request: OpenBuyerConversationRequest) {
    return this.buyerP4BridgeService.openConversation(request);
  }

  /** Forward to Shilat POST /ai/generate — same contract as P4 (for B2 tests and direct integration). */
  @Post('ai/generate')
  generateBuyerAi(@Body() request: P4AiGenerateRequest) {
    return this.p4AiGenerateClient.generateBuyerExtract(request);
  }

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

  @Get('sessions/:sessionId/review')
  getCriteriaReview(@Param('sessionId') sessionId: string) {
    return this.buyerCriteriaService.getCriteriaReview(sessionId);
  }

  @Get('sessions/:sessionId')
  getSessionSnapshot(@Param('sessionId') sessionId: string) {
    return this.buyerCriteriaService.getSessionSnapshot(sessionId);
  }

  @Post('sessions/:sessionId/search')
  searchSession(@Param('sessionId') sessionId: string) {
    return this.buyerSessionSearchService.searchForSession(sessionId);
  }

  /** P4 readiness gate before POST .../search (Shilat readyForFunction). */
  @Post('sessions/:sessionId/ai/readiness')
  evaluateSearchReadiness(
    @Param('sessionId') sessionId: string,
    @Body() body: { context?: P4BuyerAiContext },
  ) {
    return this.buyerP4BridgeService.evaluateSearchReadiness(sessionId, body.context);
  }
}
