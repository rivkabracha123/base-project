import 'reflect-metadata';
import 'dotenv/config';

import { DataSource } from 'typeorm';

import { AuctionLotEntity } from './auction-lot.entity';
import { CreateAuctionLots1710000000000 } from './1710000000000-create-auction-lots';
import { CreateMonabidBasicSchema1710000000001 } from './1710000000001-create-monabid-basic-schema';
import { UserProfileEntity } from './user-profile.entity';
import { CreateUserProfiles1730000000000 } from './1730000000000-create-user-profiles';
import { SellerLeadEntity } from './seller-lead.entity';
import { SellerIntakeDraftEntity } from './seller-intake-draft.entity';
import { CreateSellerLeads1788220800000 } from './1788220800000-create-seller-leads';
import { AddSellerLeadRecommendation1788220800001 } from './1788220800001-add-seller-lead-recommendation';
import { AddSellerLeadChoice1788220800002 } from './1788220800002-add-seller-lead-choice';
import { AddSellerLeadFinal1788220800003 } from './1788220800003-add-seller-lead-final';
import { AddSellerLeadDashboard1788220800004 } from './1788220800004-add-seller-lead-dashboard';
import { CreateSellerIntakeDrafts1788220800005 } from './1788220800005-create-seller-intake-drafts';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://monabid:monabid@localhost:5432/monabid';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [AuctionLotEntity, UserProfileEntity, SellerLeadEntity, SellerIntakeDraftEntity],
  migrations: [
    CreateAuctionLots1710000000000,
    CreateMonabidBasicSchema1710000000001,
    CreateUserProfiles1730000000000,
    CreateSellerLeads1788220800000,
    AddSellerLeadRecommendation1788220800001,
    AddSellerLeadChoice1788220800002,
    AddSellerLeadFinal1788220800003,
    AddSellerLeadDashboard1788220800004,
    CreateSellerIntakeDrafts1788220800005,
  ],
  synchronize: false,
  logging: false,
});

export default AppDataSource;
