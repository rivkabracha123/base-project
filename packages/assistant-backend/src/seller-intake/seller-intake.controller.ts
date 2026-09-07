import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { SellerIntakeAiMock } from './seller-intake-ai.mock';

// Receives seller messages and returns their extracted draft information.
@Controller('seller-intake')
export class SellerIntakeController {
  constructor(private readonly sellerIntakeAiMock: SellerIntakeAiMock) {}

  @Post('draft')
  createDraft(@Body('input') input: unknown): ReturnType<SellerIntakeAiMock['analyze']> {
    if (typeof input !== 'string' || input.trim().length === 0) {
      throw new BadRequestException('input must be a non-empty string');
    }

    return this.sellerIntakeAiMock.analyze(input);
  }
}
