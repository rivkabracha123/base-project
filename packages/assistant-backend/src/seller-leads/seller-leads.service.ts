import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  type LoggerService,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  HouseRanking,
  PreparedAuctionHouse,
  RankingItem,
  SellerLeadHistoryEvent,
} from '@monabid/shared';
import { Repository } from 'typeorm';
import { SellerLeadEntity } from '../database/seller-lead.entity';
import type { CreateSellerLeadDto } from './create-seller-lead.dto';
import { loadPreparedHouses } from './house-rank-fixture';
import { rankActiveHouses } from './house-rank';
import type { SubmitSellerLeadDto } from './submit-seller-lead.dto';

const UNSUPPORTED_CLAIM = /commission|shipping|will accept|consignment accepted/i;

function historyEvent(
  event: SellerLeadHistoryEvent['event'],
  actor: SellerLeadHistoryEvent['actor'],
): SellerLeadHistoryEvent {
  return { at: new Date().toISOString(), event, actor };
}

function hasRequiredContact(lead: SellerLeadEntity): boolean {
  const name = lead.contact?.preferredName?.trim();
  return Boolean(name && (lead.contact.email || lead.contact.phone));
}

function claimText(payload: SubmitSellerLeadDto): string {
  return [
    payload.catalogDraft.he,
    payload.catalogDraft.en,
    payload.item.title,
    payload.valuation.reason ?? '',
  ].join(' ');
}

/** S5 service: internal seller leads. Never emails or contacts an auction house. */
@Injectable()
export class SellerLeadsService {
  constructor(
    @InjectRepository(SellerLeadEntity)
    private readonly sellerLeads: Repository<SellerLeadEntity>,
    @Optional()
    @Inject(Logger)
    private readonly logger: LoggerService = new Logger(SellerLeadsService.name),
  ) {}

  /** S5 Week 2: persist an internal lead. Logs the id only — never email/phone. */
  async draft(enquiry: CreateSellerLeadDto): Promise<SellerLeadEntity> {
    const lead = await this.sellerLeads.save(
      this.sellerLeads.create({
        profileId: enquiry.profileId,
        contact: enquiry.contact,
        recommendation: null,
        sellerChoice: null,
        catalogDraft: null,
        item: null,
        evidence: null,
        valuation: null,
        comparables: null,
        serviceConsent: enquiry.serviceConsent === true,
        status: 'draft',
        history: [historyEvent('drafted', 'system')],
      }),
    );

    this.logger.log(`Drafted seller lead ${lead.id}`);

    return lead;
  }

  /** S5 Week 3: score only active prepared houses for an S1-shaped item. */
  rankHouses(item: RankingItem, houses?: PreparedAuctionHouse[]): HouseRanking {
    const ranking = rankActiveHouses(houses ?? loadPreparedHouses(), item);
    this.logger.log(
      `Ranked ${ranking.alternatives.length + (ranking.recommendation ? 1 : 0)} active prepared houses`,
    );
    return ranking;
  }

  /** S5 Week 3: write the ranking onto the lead without touching sellerChoice. */
  async attachRanking(leadId: string, ranking: HouseRanking): Promise<SellerLeadEntity> {
    const lead = await this.requireLead(leadId);
    lead.recommendation = ranking;
    lead.history = [...(lead.history ?? []), historyEvent('ranked', 'system')];
    const saved = await this.sellerLeads.save(lead);
    this.logger.log(`Stored house ranking on seller lead ${saved.id}`);
    return saved;
  }

  /**
   * S5 Week 4: store the seller’s override in sellerChoice.
   * The pick must be an active ranked house. The stored recommendation must stay the same.
   */
  async saveSellerChoice(leadId: string, houseId: string): Promise<SellerLeadEntity> {
    const lead = await this.requireLead(leadId);
    const ranking = lead.recommendation;
    if (!ranking) {
      throw new BadRequestException('Rank active houses before saving a seller choice');
    }

    // Same rule as the S5 screen: inactive / excluded houses are not selectable.
    const selectable = [ranking.recommendation, ...ranking.alternatives].filter(
      (row): row is NonNullable<typeof ranking.recommendation> => Boolean(row?.house.active),
    );
    const picked = selectable.find((row) => row.house.id === houseId);
    if (!picked) {
      throw new BadRequestException('Seller choice must be an active ranked house');
    }

    const previousRecommendationId = ranking.recommendation?.house.id;
    lead.sellerChoice = {
      houseId: picked.house.id,
      houseName: picked.house.name,
      source: 'seller',
    };
    lead.history = [...(lead.history ?? []), historyEvent('chose_house', 'seller')];
    const saved = await this.sellerLeads.save(lead);
    this.logger.log(`Stored seller house choice on seller lead ${saved.id}`);

    // Failure mode S5 must prevent: recommendation overriding (or being overwritten by) seller choice.
    if (saved.recommendation?.recommendation?.house.id !== previousRecommendationId) {
      throw new Error('Seller choice must not overwrite the stored recommendation');
    }

    return saved;
  }

  /**
   * S5 Week 5: attach the S1 catalog draft and S4 valuation, then mark the internal lead submitted.
   * Does not email, call, or otherwise contact an auction house.
   */
  async submitFinal(leadId: string, payload: SubmitSellerLeadDto): Promise<SellerLeadEntity> {
    const lead = await this.requireLead(leadId);

    if (lead.status === 'submitted') {
      throw new BadRequestException('Seller lead is already submitted');
    }
    if (!hasRequiredContact(lead)) {
      throw new BadRequestException('Lead requires a name and email or phone');
    }
    if (!lead.sellerChoice) {
      throw new BadRequestException('Save a seller house choice before creating the final lead');
    }
    if (UNSUPPORTED_CLAIM.test(claimText(payload))) {
      throw new BadRequestException('Unsupported commission or acceptance claims');
    }

    const previousRecommendationId = lead.recommendation?.recommendation?.house.id;
    const previousChoiceId = lead.sellerChoice.houseId;

    lead.catalogDraft = payload.catalogDraft;
    lead.item = payload.item;
    lead.evidence = payload.evidence;
    lead.valuation = payload.valuation;
    lead.comparables = payload.comparables ?? lead.comparables;
    lead.status = 'submitted';
    lead.history = [...(lead.history ?? []), historyEvent('submitted', 'seller')];

    const saved = await this.sellerLeads.save(lead);
    this.logger.log(`Submitted internal seller lead ${saved.id}`);

    if (saved.recommendation?.recommendation?.house.id !== previousRecommendationId) {
      throw new Error('Final lead must not overwrite the stored recommendation');
    }
    if (saved.sellerChoice?.houseId !== previousChoiceId) {
      throw new Error('Final lead must not overwrite the stored seller choice');
    }

    return saved;
  }

  /** S5 → P5: one lead by id. Throws 404 when missing. */
  async get(leadId: string): Promise<SellerLeadEntity> {
    return this.requireLead(leadId);
  }

  /** S5 handoff: P5 list (internal). Dashboard detail uses get(). */
  async list(): Promise<SellerLeadEntity[]> {
    return this.sellerLeads.find({ order: { createdAt: 'DESC' } });
  }

  private async requireLead(leadId: string): Promise<SellerLeadEntity> {
    const lead = await this.sellerLeads.findOneBy({ id: leadId });
    if (!lead) {
      throw new NotFoundException(`Seller lead ${leadId} was not found`);
    }
    return lead;
  }
}
