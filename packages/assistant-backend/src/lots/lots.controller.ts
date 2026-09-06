import { Controller, Get, Param, Query } from '@nestjs/common';
import type { AuctionLot } from '@monabid/shared';
import { LotQueryDto } from './lot-query.dto';
import { LotsImportReportService } from './lots-import-report.service';
import { LotsService } from './lots.service';
import { PaginatedResult } from './paginated-result.interface';

@Controller('lots')
export class LotsController {
  constructor(
    private readonly lotsService: LotsService,
    private readonly importReports: LotsImportReportService,
  ) {}

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

  @Get('import-report')
  report() {
    return this.importReports.getReport();
  }

  @Get(':id')
  one(@Param('id') id: string, @Query() _query: LotQueryDto): Promise<AuctionLot> {
    return this.lotsService.findOne(id);
  }
}