import 'reflect-metadata';
import 'dotenv/config';

import { DataSource } from 'typeorm';

import { AuctionLotEntity } from './auction-lot.entity';
import { CreateAuctionLots1710000000000 } from './1710000000000-create-auction-lots';
import { CreateMonabidBasicSchema1710000000001 } from './1710000000001-create-monabid-basic-schema';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://monabid:monabid@localhost:5432/monabid';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [AuctionLotEntity],
  migrations: [
    CreateAuctionLots1710000000000,
    CreateMonabidBasicSchema1710000000001,
  ],
  synchronize: false,
  logging: false,
});

export default AppDataSource;