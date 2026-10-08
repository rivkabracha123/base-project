// This file wires the controller and service together so NestJS knows they belong to the same feature.
import { Module } from '@nestjs/common';
import { ValuationCalculationController } from './valuation-calculation.controller';
import { ValuationCalculationService } from './valuation-calculation.service';
import { ScenarioComparisonController } from './scenario-comparison.controller';
import { ScenarioComparisonService } from './scenario-comparison.service';

@Module({
  // External connection
  controllers: [ValuationCalculationController, ScenarioComparisonController],
  // Performs the connections; the calculation service is exported for S5 (seller leads).
  providers: [ValuationCalculationService, ScenarioComparisonService],
  exports: [ValuationCalculationService],
})
export class ValuationCalculationModule {}
