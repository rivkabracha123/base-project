import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import type { HouseRanking } from '@monabid/shared';
import { CreateSellerLeadDto } from './create-seller-lead.dto';
import { RankHousesDto } from './rank-houses.dto';
import type { SellerLeadSummary } from './seller-lead-summary';
import { SellerLeadsService } from './seller-leads.service';

@Controller('seller-leads')
export class SellerLeadsController {
  constructor(private readonly sellerLeads: SellerLeadsService) {}

  @Post()
  async create(@Body() enquiry: CreateSellerLeadDto): Promise<{ id: string }> {
    const lead = await this.sellerLeads.draft(enquiry);

    return { id: lead.id };
  }

  @Post('house-rankings')
  @HttpCode(200)
  rank(@Body() query: RankHousesDto): HouseRanking {
    return this.sellerLeads.rankHouses(
      {
        category: query.category,
        geography: query.geography,
        preferredLanguage: query.preferredLanguage,
      },
      query.houses,
    );
  }

  @Post(':id/house-rankings')
  @HttpCode(200)
  async rankAndStore(
    @Param('id') id: string,
    @Body() query: RankHousesDto,
  ): Promise<HouseRanking> {
    const ranking = this.sellerLeads.rankHouses(
      {
        category: query.category,
        geography: query.geography,
        preferredLanguage: query.preferredLanguage,
      },
      query.houses,
    );
    await this.sellerLeads.attachRanking(id, ranking);
    return ranking;
  }

  @Get()
  async list(): Promise<SellerLeadSummary[]> {
    const leads = await this.sellerLeads.list();

    return leads.map((lead) => ({
      id: lead.id,
      profileId: lead.profileId,
      contact: lead.contact,
      recommendation: lead.recommendation ?? null,
      createdAt: lead.createdAt.toISOString(),
    }));
  }
}
