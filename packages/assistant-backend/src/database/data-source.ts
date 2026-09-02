import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AuctionLotEntity } from './auction-lot.entity';
import { StaffOperationEntity } from './staff-operation.entity';
import { CreateAuctionLots1710000000000 } from './1710000000000-create-auction-lots';
import { CreateStaffOperations1725000000000 } from './1725000000000-create-staff-operations';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://monabid:monabid@localhost:5432/monabid';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [AuctionLotEntity, StaffOperationEntity],
  migrations: [CreateAuctionLots1710000000000, CreateStaffOperations1725000000000],
  synchronize: false,
  logging: false,
});

export default AppDataSource;