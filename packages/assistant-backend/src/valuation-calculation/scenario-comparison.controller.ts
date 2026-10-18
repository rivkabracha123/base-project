import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ScenarioComparisonDto } from './scenario-comparison.dto';
import { ScenarioComparisonService } from './scenario-comparison.service';

// HTTP entry point only: compares two revisions supplied by the caller and stores nothing.
@Controller('valuation-calculation')
export class ScenarioComparisonController {
  constructor(private readonly scenarioComparison: ScenarioComparisonService) {}

  @Post('comparison')
  @HttpCode(200)
  compare(@Body() dto: ScenarioComparisonDto) {
    return this.scenarioComparison.compare(dto.previous, dto.current);
  }
}
