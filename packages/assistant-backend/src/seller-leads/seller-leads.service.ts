import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  type LoggerService,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { HouseRanking, PreparedAuctionHouse, RankingItem } from '@monabid/shared';
import { Repository } from 'typeorm';
import { SellerLeadEntity } from '../database/seller-lead.entity';
import type { CreateSellerLeadDto } from './create-seller-lead.dto';
import { loadPreparedHouses } from './house-rank-fixture';
import { rankActiveHouses } from './house-rank';

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
      this.sellerLeads.create({
        profileId: enquiry.profileId,
        contact: enquiry.contact,
        recommendation: null,
      }),
    );

    this.logger.log(`Drafted seller lead ${lead.id}`);

    return lead;
  }

  rankHouses(item: RankingItem, houses?: PreparedAuctionHouse[]): HouseRanking {
    const ranking = rankActiveHouses(houses ?? loadPreparedHouses(), item);
    this.logger.log(
      `Ranked ${ranking.alternatives.length + (ranking.recommendation ? 1 : 0)} active prepared houses`,
    );
    return ranking;
  }

  async attachRanking(leadId: string, ranking: HouseRanking): Promise<SellerLeadEntity> {
    const lead = await this.sellerLeads.findOneBy({ id: leadId });
    if (!lead) {
      throw new NotFoundException(`Seller lead ${leadId} was not found`);
    }

    lead.recommendation = ranking;
    const saved = await this.sellerLeads.save(lead);
    this.logger.log(`Stored house ranking on seller lead ${saved.id}`);
    return saved;
  }

  async list(): Promise<SellerLeadEntity[]> {
    return this.sellerLeads.find({ order: { createdAt: 'DESC' } });
  }
}
