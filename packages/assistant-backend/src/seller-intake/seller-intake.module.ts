import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerIntakeDraftEntity } from '../database/seller-intake-draft.entity';
import { SellerIntakeAiMock } from './seller-intake-ai.mock';
import { SELLER_INTAKE_AI_PROVIDER } from './seller-intake-ai.provider';
import { SellerIntakeController } from './seller-intake.controller';
import { SellerIntakeDraftsService } from './seller-intake-drafts.service';
import { SellerIntakeService } from './seller-intake.service';

@Module({
  imports: [TypeOrmModule.forFeature([SellerIntakeDraftEntity])],
  controllers: [SellerIntakeController],
  providers: [
    SellerIntakeService,
    SellerIntakeAiMock,
    { provide: SELLER_INTAKE_AI_PROVIDER, useExisting: SellerIntakeAiMock },
    SellerIntakeDraftsService,
  ],
  exports: [SellerIntakeAiMock, SELLER_INTAKE_AI_PROVIDER, SellerIntakeService],
})
export class SellerIntakeModule {}
