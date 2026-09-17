import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AuctionLotEntity } from './auction-lot.entity';
import { StaffOperationEntity } from './staff-operation.entity';
import { UserProfileEntity } from './user-profile.entity';
import { CreateAuctionLots1710000000000 } from './1710000000000-create-auction-lots';
import { CreateTeamTables1710000000001 } from './1710000000001-create-team-tables';
import { CreateBuyerTables1710000000002 } from './1710000000002-create-buyer-tables';
import { AiProviderConfigEntity } from './ai-provider-config.entity';
import { AnonymousProfileEntity } from './anonymous-profile.entity';
import { SellerLeadEntity } from './seller-lead.entity';
import { BuyerRequestEntity } from './buyer-request.entity';
import { BuyerCriteriaEntity } from './buyer-criteria.entity';
import { BuyerConversationEntity } from './buyer-conversation.entity';
import { CreateStaffOperations1725000000000 } from './1725000000000-create-staff-operations';
import { CreateUserProfiles1730000000000 } from './1730000000000-create-user-profiles';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://monabid:monabid@localhost:5432/monabid';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [
    AuctionLotEntity,
    AnonymousProfileEntity,
    AiProviderConfigEntity,
    SellerLeadEntity,
    BuyerRequestEntity,
    BuyerCriteriaEntity,
    BuyerConversationEntity,
    UserProfileEntity,
    StaffOperationEntity,
  ],
  migrations: [
    CreateAuctionLots1710000000000,
    CreateTeamTables1710000000001,
    CreateBuyerTables1710000000002,
    CreateUserProfiles1730000000000,
    CreateStaffOperations1725000000000,
  ],
  synchronize: false,
  logging: false,
});

export default AppDataSource;
