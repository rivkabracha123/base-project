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
import {
  itemVersionFromS1Draft,
  receiveConfirmedItemHandoff,
  sellerContactFromP3Profile,
  sellerItemFromS1Draft,
  sellerLeadValuationSchema,
  type HouseRanking,
  type PreparedAuctionHouse,
  type RankingItem,
  type SellerLeadComparableRef,
  type SellerLeadHistoryEvent,
  type SellerLeadValuation,
} from '@monabid/shared';
import { Repository } from 'typeorm';
import { SellerLeadEntity } from '../database/seller-lead.entity';
import { ProfilesService } from '../profiles/profiles.service';
import { toSellerLeadValuationSnapshot } from '../valuation-calculation/dashboard-valuation';
import { isSafeIdentifier } from '../valuation-calculation/privacy-projection';
import { ItemValuationService } from '../valuation-calculation/item-valuation.service';
import type { CompleteSellerEnquiryDto } from './complete-seller-enquiry.dto';
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
    payload.enquiryText ?? '',
    payload.item.title,
    payload.valuation.reason ?? '',
  ].join(' ');
}

/** Class-validator sees a wide DTO; persist the S4 discriminated union Zod already checked. */
function toStoredValuation(valuation: SubmitSellerLeadDto['valuation']): SellerLeadValuation {
  return sellerLeadValuationSchema.parse(valuation);
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
    @Optional()
    private readonly profiles?: ProfilesService,
    @Optional()
    private readonly itemValuation?: ItemValuationService,
  ) {}

  /** Copy P3 current-profile fields onto a draft enquiry when the anonymous session is present. */
  async applyP3Profile(
    enquiry: CreateSellerLeadDto,
    sessionId?: string,
  ): Promise<CreateSellerLeadDto> {
    if (!sessionId || !this.profiles) return enquiry;

    const fromP3 = sellerContactFromP3Profile(await this.profiles.getOrCreateBySessionId(sessionId));
    if (!fromP3.serviceConsent) {
      throw new BadRequestException('P3 service consent is required before creating a seller lead');
    }

    return {
      profileId: fromP3.profileId,
      serviceConsent: true,
      contact: {
        preferredName: fromP3.preferredName || enquiry.contact.preferredName,
        email: fromP3.email ?? enquiry.contact.email,
        phone: fromP3.phone ?? enquiry.contact.phone,
      },
    };
  }

  /** S5 Week 2: persist an internal lead. Logs the id only — never email/phone. */
  async draft(enquiry: CreateSellerLeadDto, sessionId?: string): Promise<SellerLeadEntity> {
    const payload = await this.applyP3Profile(enquiry, sessionId);
    const lead = await this.sellerLeads.save(
      this.sellerLeads.create({
        profileId: payload.profileId,
        contact: payload.contact,
        recommendation: null,
        sellerChoice: null,
        catalogDraft: null,
        item: null,
        evidence: null,
        valuation: null,
        comparables: null,
        serviceConsent: payload.serviceConsent === true,
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

  /**
   * S1 callback: confirmed SellerItemDraft / buildHandoffPayload in,
   * ranking + copied catalog + live S3/S4 valuation out.
   * Does not create a lead (contact/consent stay on P3) and never contacts a house.
   */
  async receiveS1Handoff(payload: unknown): Promise<{
    ranking: HouseRanking;
    catalogDraft: { he: string; en: string };
    item: { id: string; category: string; title: string; evidenceIds: string[] };
    evidence: Array<{ id: string; type: string }>;
    valuation: SellerLeadValuation | null;
    comparables: SellerLeadComparableRef[];
  }> {
    let copied: ReturnType<typeof receiveConfirmedItemHandoff>;
    try {
      copied = receiveConfirmedItemHandoff(payload);
    } catch {
      throw new BadRequestException('S1 handoff must include item id, category, title, and catalogDraft');
    }

    const ranking = this.rankHouses(copied.rankingItem);
    const live = await this.liveS4Valuation(payload, copied.item.id);
    return {
      ranking,
      catalogDraft: copied.catalogDraft,
      item: copied.item,
      evidence: copied.evidence,
      valuation: live.valuation,
      comparables: live.comparables,
    };
  }

  /** Copy S4's dashboard snapshot. Never recalculate and never invent a refusal. */
  private async liveS4Valuation(
    payload: unknown,
    itemId: string,
  ): Promise<{ valuation: SellerLeadValuation | null; comparables: SellerLeadComparableRef[] }> {
    if (!this.itemValuation) return { valuation: null, comparables: [] };
    try {
      const rawVersion = itemVersionFromS1Draft(payload);
      const report = await this.itemValuation.calculateFromItem({
        itemId,
        itemVersion: isSafeIdentifier(rawVersion) ? rawVersion : 'confirmed',
        item: sellerItemFromS1Draft(payload),
      });
      const snapshot = toSellerLeadValuationSnapshot(report).dashboard;
      const parsed = sellerLeadValuationSchema.safeParse(snapshot);
      if (!parsed.success) return { valuation: null, comparables: [] };
      return {
        valuation: parsed.data,
        comparables: parsed.data.comparables.map((row) => ({
          id: row.id,
          source: row.source.label,
        })),
      };
    } catch {
      return { valuation: null, comparables: [] };
    }
  }

  /**
   * Display already ranked via s1-handoff. Persist ranks once, stores choice, then submits.
   * Week 4 stepwise APIs stay for house-choice and contract tests.
   */
  async completeEnquiry(payload: CompleteSellerEnquiryDto, sessionId?: string): Promise<SellerLeadEntity> {
    const generalEnquiry = payload.generalEnquiry === true;
    if (generalEnquiry === Boolean(payload.houseId)) {
      throw new BadRequestException('Choose a house or explicitly submit a general internal enquiry');
    }
    const enquiry = await this.applyP3Profile(
      {
        profileId: payload.profileId ?? 'profile-synthetic-seller-1',
        contact: payload.contact,
        serviceConsent: true,
      },
      sessionId,
    );
    const lead = await this.draft(enquiry);
    if (!generalEnquiry) {
      const ranking = this.rankHouses({
        category: payload.item.category,
        geography: payload.geography,
        preferredLanguage: payload.preferredLanguage,
      });
      await this.attachRanking(lead.id, ranking);
      await this.saveSellerChoice(lead.id, payload.houseId!);
    }
    return this.submitFinal(lead.id, payload, generalEnquiry);
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
  async submitFinal(leadId: string, payload: SubmitSellerLeadDto, allowNoHouseChoice = false): Promise<SellerLeadEntity> {
    const lead = await this.requireLead(leadId);

    if (lead.status === 'submitted') {
      throw new BadRequestException('Seller lead is already submitted');
    }
    if (!hasRequiredContact(lead)) {
      throw new BadRequestException('Lead requires a name and email or phone');
    }
    if (!lead.sellerChoice && !allowNoHouseChoice) {
      throw new BadRequestException('Save a seller house choice before creating the final lead');
    }
    if (UNSUPPORTED_CLAIM.test(claimText(payload))) {
      throw new BadRequestException('Unsupported commission or acceptance claims');
    }

    const previousRecommendationId = lead.recommendation?.recommendation?.house.id;
    const previousChoiceId = lead.sellerChoice?.houseId;

    lead.catalogDraft = payload.catalogDraft;
    lead.item = payload.item;
    lead.evidence = payload.evidence;
    lead.valuation = toStoredValuation(payload.valuation);
    if (payload.enquiryText !== undefined) lead.enquiryText = payload.enquiryText;
    lead.comparables = payload.comparables ?? lead.comparables;
    lead.status = 'submitted';
    lead.history = [...(lead.history ?? []), historyEvent('submitted', 'seller')];

    const saved = await this.sellerLeads.save(lead);
    this.logger.log(`Submitted internal seller lead ${saved.id}`);

    if (saved.recommendation?.recommendation?.house.id !== previousRecommendationId) {
      throw new Error('Final lead must not overwrite the stored recommendation');
    }
    if (previousChoiceId && saved.sellerChoice?.houseId !== previousChoiceId) {
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
