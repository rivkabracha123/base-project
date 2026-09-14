// This file wires the controller and service together so NestJS knows they belong to the same feature.
import { Module } from '@nestjs/common';
import { ValuationCalculationController } from './valuation-calculation.controller';
import { ValuationCalculationService } from './valuation-calculation.service';

@Module({
  // External connection
  controllers: [ValuationCalculationController],
  // Performs the connections
  providers: [ValuationCalculationService],
})
export class ValuationCalculationModule {}
