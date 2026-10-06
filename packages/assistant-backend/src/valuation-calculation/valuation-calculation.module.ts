// This file wires the controller and service together so NestJS knows they belong to the same feature.
import { Module } from '@nestjs/common';
import { ValuationCalculationController } from './valuation-calculation.controller';
import { ValuationCalculationService } from './valuation-calculation.service';

@Module({
  controllers: [ValuationCalculationController],
  providers: [ValuationCalculationService],
  exports: [ValuationCalculationService],
})
export class ValuationCalculationModule {}
