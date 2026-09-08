import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateSellerLeadDto } from './create-seller-lead.dto';
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

  @Get()
  async list(): Promise<SellerLeadSummary[]> {
    const leads = await this.sellerLeads.list();

    return leads.map((lead) => ({
      id: lead.id,
      profileId: lead.profileId,
      contact: lead.contact,
      createdAt: lead.createdAt.toISOString(),
    }));
  }
}
