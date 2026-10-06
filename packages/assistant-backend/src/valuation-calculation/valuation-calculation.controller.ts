// DTO = Data Transfer Object: the validated request-body shape enforced by the global ValidationPipe in main.ts.

import { Body, Controller, Post } from '@nestjs/common';
import { ValuationInputDto } from './valuation-calculation.dto';
import { ValuationCalculationService } from './valuation-calculation.service';

//
// Controller: the HTTP entry point that routes requests to the right service method.
@Controller('valuation-calculation')
export class ValuationCalculationController {
  constructor(private readonly valuationCalculationService: ValuationCalculationService) {}


  // DTO = Data Transfer Object: transfers the already-validated data to the service; no business logic lives here.
  @Post('valuation')
  postValuation(@Body() dto: ValuationInputDto) {
    return this.valuationCalculationService.calculateValuation(dto);
  }
}
