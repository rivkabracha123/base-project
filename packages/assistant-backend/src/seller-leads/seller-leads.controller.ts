import { Body, Controller, Post } from '@nestjs/common';
import { CreateSellerLeadDto } from './create-seller-lead.dto';
import { SellerLeadsService } from './seller-leads.service';

@Controller('seller-leads')
export class SellerLeadsController {
  constructor(private readonly sellerLeads: SellerLeadsService) {}

  @Post()
  async create(@Body() enquiry: CreateSellerLeadDto): Promise<{ id: string }> {
    const lead = await this.sellerLeads.draft(enquiry);

    return { id: lead.id };
  }
}
