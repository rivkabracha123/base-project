import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import type { ComparableEvidence } from '@monabid/shared';
import { ComparableQueryDto } from './comparable-query.dto';
import { ComparablesService } from './comparables.service';

@Controller('comparables')
export class ComparablesController {
  constructor(private readonly service: ComparablesService) {}

  // Week 2 scaffold: query by confirmed category only (from S1). Later weeks add creator, period,
  // medium, and the other scoring inputs listed in the comparable-matching contract.
  @Post('query')
  @HttpCode(200)
  query(@Body() dto: ComparableQueryDto): Promise<ComparableEvidence> {
    return this.service.findComparables({ category: dto.category });
  }
}
