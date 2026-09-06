// DTO = Data Transfer Object: the validated request-body shape enforced by the global ValidationPipe in main.ts.

import { Body, Controller, Post } from '@nestjs/common';
import { ValuationInputDto } from './aluma-shilat.dto';
import { AlomaShilatService } from './aluma-shilat.service';

//
// Controller: the HTTP entry point that routes requests to the right service method.
@Controller('aluma-shilat')
export class AlomaShilatController {
  constructor(private readonly alomaShilatService: AlomaShilatService) {}


  // DTO = Data Transfer Object: transfers the already-validated data to the service; no business logic lives here.
  @Post('valuation')
  postValuation(@Body() dto: ValuationInputDto) {
    return this.alomaShilatService.calculateValuation(dto);
  }
}
