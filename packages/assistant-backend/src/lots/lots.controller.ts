import { Controller, Get, Param, Query } from '@nestjs/common';
import type { AuctionLot, PaginatedResult } from '@monabid/shared';
import { LotQueryDto } from './lot-query.dto';
import { LotsService } from './lots.service';

@Controller('lots')
export class LotsController {
  constructor(private readonly lotsService: LotsService) {}

  @Get()
  search(@Query() query: LotQueryDto): Promise<PaginatedResult<AuctionLot>> {
   
    return this.lotsService.searchByText(
      query.query,
      query.language ?? 'he',
      query.page,
      query.limit
    );
  }

  @Get('sample')
  sample(@Query() _query: LotQueryDto): Promise<AuctionLot> {
    return this.lotsService.findSample();
  }

  @Get(':id')
  one(@Param('id') id: string, @Query() _query: LotQueryDto): Promise<AuctionLot> {
    return this.lotsService.findOne(id);
  }
}