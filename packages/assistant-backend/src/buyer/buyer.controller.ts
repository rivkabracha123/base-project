import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { ShilatAiGenerateRequest } from '../ai/p4-ai.types';
import { P4AiGenerateClient } from '../ai/p4-ai-generate.client';
import { BuyerCriteriaService } from './buyer-criteria.service';
import { BuyerP4BridgeService } from './buyer-p4-bridge.service';
import { BuyerSessionSearchService } from './buyer-session-search.service';
import type { P4BuyerAiContext } from '../ai/p4-ai.types';
import type { OpenBuyerConversationRequest } from './buyer-conversation.dto';
import type { BuyerConversationMessageRequest } from './buyer-conversation-message.dto';
import { BuyerChatOrchestratorService } from './buyer-chat-orchestrator.service';
import {
  BuyerComparableSaleHistoryService,
  type ComparableSaleHistoryRequest,
} from './buyer-comparable-sale-history.service';
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
    private readonly buyerChatOrchestratorService: BuyerChatOrchestratorService,
    private readonly buyerComparableSaleHistoryService: BuyerComparableSaleHistoryService,
  ) {}

  /** B2 handler for Shilat functionName getComparableSaleHistory. */
  @Post('comparable-sale-history')
  async comparableSaleHistory(@Body() request: ComparableSaleHistoryRequest) {
    return this.buyerComparableSaleHistoryService.getHistory(request);
  }

  /** B2 orchestrator: one buyer message → P4 (Shilat) → criteria → search → updates for Tamar. */
  @Post('conversation/message')
  handleConversationMessage(@Body() request: BuyerConversationMessageRequest) {
    return this.buyerChatOrchestratorService.handleMessage(request);
  }

  /** P4 bridge: buyer message → /ai/generate → criteria session (preferred over raw POST /extract). */
  @Post('conversation/open')
  openConversation(@Body() request: OpenBuyerConversationRequest) {
    return this.buyerP4BridgeService.openConversation(request);
  }

  /** Proxy to Shilat POST /ai/generate — body: { prompt, language, sessionId?, selectedLot?, lots? }. */
  @Post('ai/generate')
  generateBuyerAi(@Body() request: ShilatAiGenerateRequest) {
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
