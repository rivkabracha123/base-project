import { IsNotEmpty, IsObject, IsString } from 'class-validator';
import type { SellerHandoffContract } from './seller-workflow.types';

export class SellerWorkflowRequestDto {
  @IsString()
  @IsNotEmpty()
  profileId: string;

  @IsObject()
  structuredAnswer: SellerHandoffContract;
}