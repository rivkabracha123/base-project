import { IsNotEmpty, IsString } from 'class-validator';

/**
 * S5 Week 4: body for POST /api/seller-leads/:id/choice.
 * Only the house id is sent; S5 looks up the display name from the stored ranking.
 */
export class ChooseSellerHouseDto {
  @IsString()
  @IsNotEmpty()
  houseId: string;
}
