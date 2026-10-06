import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type {
  HouseRanking,
  SellerChoice,
  SellerLeadDashboardDetail,
  SellerLeadSummary,
} from '@monabid/shared';
import { ChooseSellerHouseDto } from './choose-seller-house.dto';
import { CreateSellerLeadDto } from './create-seller-lead.dto';
import { RankHousesDto } from './rank-houses.dto';
import { toSellerLeadDashboardDetail } from './seller-lead-dashboard';
import { toSellerLeadSummary } from './seller-lead-summary';
import { SellerLeadsService } from './seller-leads.service';
import { SubmitSellerLeadDto } from './submit-seller-lead.dto';

/** S5 HTTP API for draft enquiry, house ranking, seller choice, final lead, and P5 list. */
@Controller('seller-leads')
export class SellerLeadsController {
  constructor(private readonly sellerLeads: SellerLeadsService) {}

  /** S5 Week 2: create an internal draft enquiry. Does not contact an auction house. */
  @Post()
  async create(
    @Body() enquiry: CreateSellerLeadDto,
    @Headers('x-anonymous-session-id') sessionId?: string,
  ): Promise<{ id: string }> {
    const lead = await this.sellerLeads.draft(enquiry, sessionId);

    return { id: lead.id };
  }

  /** S5 Week 3: rank without storing (used by contract tests and evidence-before-contact UI). */
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

  /**
   * S1 callback when the confirmed catalog draft is ready.
   * POST the draft; the 200 JSON is ranking + catalog + live S4 valuation for the seller UI.
   */
  @Post('s1-handoff')
  @HttpCode(200)
  receiveS1Handoff(@Body() payload: unknown): ReturnType<SellerLeadsService['receiveS1Handoff']> {
    return this.sellerLeads.receiveS1Handoff(payload);
  }

  /** S5 Week 3: rank P1 houses for this lead and persist the ranking for P5. */
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

  /**
   * S5 Week 4: save the seller’s house pick on this lead.
   * Returns SellerChoice only — the ranked recommendation stays on the lead unchanged.
   */
  @Post(':id/choice')
  @HttpCode(200)
  async chooseHouse(
    @Param('id') id: string,
    @Body() body: ChooseSellerHouseDto,
  ): Promise<SellerChoice> {
    const lead = await this.sellerLeads.saveSellerChoice(id, body.houseId);
    if (!lead.sellerChoice) {
      throw new Error('Seller choice was not stored');
    }
    return lead.sellerChoice;
  }

  /**
   * S5 Week 5: persist catalog draft + item/evidence/valuation and mark the lead submitted.
   * Returns the P5 dashboard row. Never contacts a house.
   */
  @Post(':id/final')
  @HttpCode(200)
  async submitFinal(
    @Param('id') id: string,
    @Body() body: SubmitSellerLeadDto,
  ): Promise<SellerLeadSummary> {
    const lead = await this.sellerLeads.submitFinal(id, body);
    return toSellerLeadSummary(lead);
  }

  /** S5 → P5: list leads with recommendation, choice, catalog draft, and status. */
  @Get()
  async list(): Promise<SellerLeadSummary[]> {
    const leads = await this.sellerLeads.list();
    return leads.map(toSellerLeadSummary);
  }

  /**
   * S5 → P5 Week 4: privacy-limited dashboard detail by leadId.
   * 400 when leadId is not a UUID; 404 when the lead does not exist.
   */
  @Get(':id')
  async get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<SellerLeadDashboardDetail> {
    const lead = await this.sellerLeads.get(id);
    return toSellerLeadDashboardDetail(lead);
  }
}
