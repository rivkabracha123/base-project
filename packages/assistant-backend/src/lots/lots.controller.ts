import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import type { AuctionLot, PaginatedResult } from '@monabid/shared';
import { LotQueryDto } from './lot-query.dto';
import { LotSearchDto } from './lot-search.dto';
import { LotsImportReportService } from './lots-import-report.service';
import { LotsService } from './lots.service';

@Controller('lots')
export class LotsController {
  constructor(
    private readonly lotsService: LotsService,
    private readonly importReports: LotsImportReportService,
  ) {}

  @Post('search')
  @HttpCode(200)
  search(@Body() body: LotSearchDto): Promise<PaginatedResult<AuctionLot>> {
    return this.lotsService.search(body);
  }

  @Get('sample')
  sample(@Query() _query: LotQueryDto): Promise<AuctionLot> {
    return this.lotsService.findSample();
  }

  @Get('import-report')
  report() {
    return this.importReports.getReport();
  }

  // This static route must precede :id, otherwise "history" would be treated
  // as a lot id instead of the history resource.
  @Get('history/:itemKey')
  history(@Param('itemKey') itemKey: string): Promise<AuctionLot[]> {
    return this.lotsService.findSaleHistoryByItemKey(itemKey);
  }

  @Get(':id')
  one(@Param('id') id: string, @Query() _query: LotQueryDto): Promise<AuctionLot> {
    return this.lotsService.findOne(id);
  }
}
