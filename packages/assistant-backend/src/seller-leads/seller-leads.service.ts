import { Inject, Injectable, Logger, Optional, type LoggerService } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SellerLeadEntity } from '../database/seller-lead.entity';
import type { CreateSellerLeadDto } from './create-seller-lead.dto';

@Injectable()
export class SellerLeadsService {
  constructor(
    @InjectRepository(SellerLeadEntity)
    private readonly sellerLeads: Repository<SellerLeadEntity>,
    @Optional()
    @Inject(Logger)
    private readonly logger: LoggerService = new Logger(SellerLeadsService.name),
  ) {}

  async draft(enquiry: CreateSellerLeadDto): Promise<SellerLeadEntity> {
    const lead = await this.sellerLeads.save(
      this.sellerLeads.create({ profileId: enquiry.profileId, contact: enquiry.contact }),
    );

    this.logger.log(`Drafted seller lead ${lead.id}`);

    return lead;
  }
}
