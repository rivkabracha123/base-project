import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GenerateAiRequestDto, GenerateAiResponseDto } from './ai.dto';
import { AiService } from './ai.service';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @ApiOperation({ summary: 'Generate a structured AI response from a prompt' })
  @ApiBody({ type: GenerateAiRequestDto })
  @ApiResponse({ status: 201, type: GenerateAiResponseDto })
  @Post('generate')
  async generate(@Body() body: GenerateAiRequestDto): Promise<GenerateAiResponseDto> {
    return this.aiService.generate({
      prompt: body.prompt,
      language: body.language,
      baseUrl: body.baseUrl,
      modelName: body.modelName,
      apiKey: body.apiKey,
    });
  }
}
