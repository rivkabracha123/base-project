import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AuctionLotEntity } from './auction-lot.entity';
import { StaffOperationEntity } from './staff-operation.entity';
import { UserProfileEntity } from './user-profile.entity';
import { CreateAuctionLots1710000000000 } from './1710000000000-create-auction-lots';
import { CreateStaffOperations1725000000000 } from './1725000000000-create-staff-operations';
import { CreateUserProfiles1730000000000 } from './1730000000000-create-user-profiles';
import { CreateMonabidBasicSchema1710000000001 } from './1710000000001-create-monabid-basic-schema';
import { SellerLeadEntity } from './seller-lead.entity';
import { CreateSellerLeads1788220800000 } from './1788220800000-create-seller-leads';
import { AddSellerLeadRecommendation1788220800001 } from './1788220800001-add-seller-lead-recommendation';
import { AddSellerLeadChoice1788220800002 } from './1788220800002-add-seller-lead-choice';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://monabid:monabid@localhost:5432/monabid';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [AuctionLotEntity, UserProfileEntity, StaffOperationEntity, SellerLeadEntity],
  migrations: [
    CreateAuctionLots1710000000000,
    CreateMonabidBasicSchema1710000000001,
    CreateStaffOperations1725000000000,
    CreateUserProfiles1730000000000,
    CreateSellerLeads1788220800000,
    AddSellerLeadRecommendation1788220800001,
    AddSellerLeadChoice1788220800002,
  ],
  synchronize: false,
  logging: false,
});

export default AppDataSource;
