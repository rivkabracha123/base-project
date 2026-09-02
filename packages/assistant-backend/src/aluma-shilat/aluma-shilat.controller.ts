import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ValuationInputDto } from './aluma-shilat.dto';
import { AlomaShilatService } from './aluma-shilat.service';

@Controller('aluma-shilat')
export class AlomaShilatController {
  constructor(private readonly alomaShilatService: AlomaShilatService) {}

  @Get('demo')
  getDemoLot() {
    return this.alomaShilatService.findDemoLot();
  }

  @Get('demo/:id')
  getDemoLotById(@Param('id') id: string) {
    return this.alomaShilatService.findDemoLotById(id);
  }

  @Post('valuation')
  postValuation(@Body() dto: ValuationInputDto) {
    return this.alomaShilatService.calculateValuation(dto);
  }
}
