import 'reflect-metadata';
import { AlignLegacySellerLeads1788220800006 } from './1788220800006-align-legacy-seller-leads';
import { AddAiConversations1750000000000 } from './1750000000000-add-ai-conversations';
import { AiHistoryEntity } from './ai-history.entity';
import { CreateAiHistory1740000000000 } from './1740000000000-create-ai-history';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AuctionLotEntity } from './auction-lot.entity';
import { StaffOperationEntity } from './staff-operation.entity';
import { UserProfileEntity } from './user-profile.entity';
import { CreateAuctionLots1710000000000 } from './1710000000000-create-auction-lots';
import { CreateMonabidBasicSchema1710000000001 } from './1710000000001-create-monabid-basic-schema';
import { CreateStaffOperations1725000000000 } from './1725000000000-create-staff-operations';
import { CreateUserProfiles1730000000000 } from './1730000000000-create-user-profiles';
import { CreateTeamTables1710000000001 } from './1710000000001-create-team-tables';
import { CreateBuyerTables1710000000002 } from './1710000000002-create-buyer-tables';
import { AiProviderConfigEntity } from './ai-provider-config.entity';
import { AnonymousProfileEntity } from './anonymous-profile.entity';
import { SellerLeadEntity } from './seller-lead.entity';
import { BuyerRequestEntity } from './buyer-request.entity';
import { BuyerCriteriaEntity } from './buyer-criteria.entity';
import { BuyerConversationEntity } from './buyer-conversation.entity';
import { BuyerUnmatchedDemandEntity } from './buyer-unmatched-demand.entity';
import { CreateBuyerUnmatchedDemand1740000000000 } from './1740000000000-create-buyer-unmatched-demand';
import { SellerIntakeDraftEntity } from './seller-intake-draft.entity';
import { CreateSellerLeads1788220800000 } from './1788220800000-create-seller-leads';
import { AddSellerLeadRecommendation1788220800001 } from './1788220800001-add-seller-lead-recommendation';
import { AddSellerLeadChoice1788220800002 } from './1788220800002-add-seller-lead-choice';
import { AddSellerLeadFinal1788220800003 } from './1788220800003-add-seller-lead-final';
import { AddSellerLeadDashboard1788220800004 } from './1788220800004-add-seller-lead-dashboard';
import { CreateSellerIntakeDrafts1788220800005 } from './1788220800005-create-seller-intake-drafts';
import { AddSellerEnquiryText1788220800007 } from './1788220800007-add-seller-enquiry-text';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://monabid:monabid@localhost:5432/monabid';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [
    AuctionLotEntity,
    UserProfileEntity,
    StaffOperationEntity,
    SellerLeadEntity,
    AnonymousProfileEntity,
    AiProviderConfigEntity,
    BuyerRequestEntity,
    BuyerCriteriaEntity,
    BuyerConversationEntity,
    BuyerUnmatchedDemandEntity,
    SellerIntakeDraftEntity,
    AiHistoryEntity,
  ],
  migrations: [
    CreateAuctionLots1710000000000,
    CreateMonabidBasicSchema1710000000001,
    CreateTeamTables1710000000001,
    CreateBuyerTables1710000000002,
    CreateStaffOperations1725000000000,
    CreateUserProfiles1730000000000,
    CreateBuyerUnmatchedDemand1740000000000,
    CreateAiHistory1740000000000,
    AddAiConversations1750000000000,
    CreateSellerLeads1788220800000,
    AddSellerLeadRecommendation1788220800001,
    AddSellerLeadChoice1788220800002,
    AddSellerLeadFinal1788220800003,
    AddSellerLeadDashboard1788220800004,
    CreateSellerIntakeDrafts1788220800005,
    AlignLegacySellerLeads1788220800006,
    AddSellerEnquiryText1788220800007,
  ],
  synchronize: false,
  logging: false,
});

export default AppDataSource;
