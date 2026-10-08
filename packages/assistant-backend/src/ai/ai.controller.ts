import { Body, Controller, DefaultValuePipe, Get, Headers, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AiHistoryService } from './ai-history.service';
import { GenerateAiRequestDto, GenerateAiResponseDto } from './ai.dto';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService, private readonly history: AiHistoryService) {}

  @Get('history')
  listHistory(
    @Headers('x-anonymous-session-id') sessionId: string | undefined,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return this.history.list(sessionId, page);
  }

  @Post('generate')
  async generate(
    @Body() body: GenerateAiRequestDto,
    @Headers('x-anonymous-session-id') sessionId?: string,
  ): Promise<GenerateAiResponseDto & { conversationId: string; exchangeId: string }> {
    const userId = await this.history.resolveUserId(sessionId);
    await this.history.validateConversation(userId, body.conversationId, body.role);
    const response = await this.aiService.generate({
      prompt: body.prompt,
      role: body.role,
      language: body.language,
      sessionId,
    });
    const entry = await this.history.record(userId, body, response);
    return { ...response, conversationId: entry.conversationId, exchangeId: entry.id };
  }

  @Get('conversations/:conversationId')
  conversation(
    @Headers('x-anonymous-session-id') sessionId: string | undefined,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.history.conversation(sessionId, conversationId);
  }
}
