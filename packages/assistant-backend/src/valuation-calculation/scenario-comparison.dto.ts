// Request body for POST /valuation-calculation/comparison. Both revisions are untrusted (the previous
// one comes from browser storage), so the pipe only checks that they are objects; their shape is
// validated against the shared snapshot schema in ScenarioComparisonService.
import { IsObject } from 'class-validator';

export class ScenarioComparisonDto {
  @IsObject()
  previous!: Record<string, unknown>;

  @IsObject()
  current!: Record<string, unknown>;
}
