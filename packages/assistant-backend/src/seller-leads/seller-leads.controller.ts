import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import type { HouseRanking, SellerChoice } from '@monabid/shared';
import { ChooseSellerHouseDto } from './choose-seller-house.dto';
import { CreateSellerLeadDto } from './create-seller-lead.dto';
import { RankHousesDto } from './rank-houses.dto';
import type { SellerLeadSummary } from './seller-lead-summary';
import { SellerLeadsService } from './seller-leads.service';

/** Rejects requests without the anonymous session header; the header identifies the caller. */
function requireSessionId(sessionId: string | undefined): string {
  if (!sessionId || sessionId.trim().length === 0) {
    throw new BadRequestException('Anonymous session ID is required');
  }
  return sessionId;
}

/** S5 HTTP API for draft enquiry, house ranking, seller choice, and P5 list. */
@Controller('seller-leads')
export class SellerLeadsController {
  constructor(private readonly sellerLeads: SellerLeadsService) {}

  /** S5 Week 2: create an internal draft enquiry. Does not contact an auction house. */
  @Post()
  async create(
    @Headers('x-anonymous-session-id') sessionId: string | undefined,
    @Body() enquiry: CreateSellerLeadDto,
  ): Promise<{ id: string }> {
    // The service verifies that enquiry.profileId belongs to this session.
    const lead = await this.sellerLeads.draft(requireSessionId(sessionId), enquiry);

    return { id: lead.id };
  }

  /** S5 Week 3: rank without storing (used by contract tests). */
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

  /** S5 Week 3: rank P1 houses for this lead and persist the ranking for P5. */
  @Post(':id/house-rankings')
  @HttpCode(200)
  async rankAndStore(
    @Headers('x-anonymous-session-id') sessionId: string | undefined,
    @Param('id') id: string,
    @Body() query: RankHousesDto,
  ): Promise<HouseRanking> {
    // Reject early (before ranking) when the caller does not own this lead.
    const session = requireSessionId(sessionId);
    const ranking = this.sellerLeads.rankHouses(
      {
        category: query.category,
        geography: query.geography,
        preferredLanguage: query.preferredLanguage,
      },
      query.houses,
    );
    await this.sellerLeads.attachRanking(session, id, ranking);
    return ranking;
  }

  /**
   * S5 Week 4: save the seller’s house pick on this lead.
   * Returns SellerChoice only — the ranked recommendation stays on the lead unchanged.
   */
  @Post(':id/choice')
  @HttpCode(200)
  async chooseHouse(
    @Headers('x-anonymous-session-id') sessionId: string | undefined,
    @Param('id') id: string,
    @Body() body: ChooseSellerHouseDto,
  ): Promise<SellerChoice> {
    // The service checks lead -> profile -> session ownership before saving the choice.
    const lead = await this.sellerLeads.saveSellerChoice(requireSessionId(sessionId), id, body.houseId);
    if (!lead.sellerChoice) {
      throw new Error('Seller choice was not stored');
    }
    return lead.sellerChoice;
  }


  /** S5 → P5: list leads with both recommendation and sellerChoice. */
  @Get()
  async list(): Promise<SellerLeadSummary[]> {
    const leads = await this.sellerLeads.list();

    return leads.map((lead) => ({
      id: lead.id,
      profileId: lead.profileId,
      contact: lead.contact,
      recommendation: lead.recommendation ?? null,
      sellerChoice: lead.sellerChoice ?? null,
      createdAt: lead.createdAt.toISOString(),
    }));
  }
}
