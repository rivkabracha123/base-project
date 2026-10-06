import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerIntakeDraftEntity } from '../database/seller-intake-draft.entity';
import { SellerIntakeAiMock } from './seller-intake-ai.mock';
import { SellerIntakeController } from './seller-intake.controller';
import { SellerIntakeDraftsService } from './seller-intake-drafts.service';
import { SellerIntakeService } from './seller-intake.service';

// Registers the seller-intake API and its extraction service with NestJS.
@Module({
  imports: [TypeOrmModule.forFeature([SellerIntakeDraftEntity])],
  controllers: [SellerIntakeController],
  providers: [SellerIntakeService, SellerIntakeAiMock, SellerIntakeDraftsService],
  exports: [SellerIntakeAiMock, SellerIntakeService],
})
export class SellerIntakeModule {}
