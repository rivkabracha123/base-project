import { Module } from '@nestjs/common';
import { SellerIntakeAiMock } from './seller-intake-ai.mock';
import { SellerIntakeController } from './seller-intake.controller';
import { SellerIntakeService } from './seller-intake.service';

// Registers the seller-intake API and its extraction service with NestJS.
@Module({
  controllers: [SellerIntakeController],
  providers: [SellerIntakeService, SellerIntakeAiMock],
})
export class SellerIntakeModule {}
