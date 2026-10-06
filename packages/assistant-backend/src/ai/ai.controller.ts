import { Body, Controller, Post } from '@nestjs/common';
import { GenerateAiRequestDto, GenerateAiResponseDto } from './ai.dto';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate')
  async generate(@Body() body: GenerateAiRequestDto): Promise<GenerateAiResponseDto> {
    return this.aiService.generate({
      prompt: body.prompt,
      role: body.role,
      language: body.language,
    });
  }
}
