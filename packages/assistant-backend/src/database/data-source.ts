import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AuctionLotEntity } from './auction-lot.entity';
import { SellerEntity } from './seller.entity';
import { SellerItemEntity } from './seller-item.entity';
import { ItemEvidenceEntity } from './item-evidence.entity';
import { ItemFactEntity } from './item-fact.entity';
import { ItemRevisionEntity } from './item-revision.entity';
import { CreateAuctionLots1710000000000 } from './1710000000000-create-auction-lots';
import { CreateSellerIntakeTables1720000000000 } from './1720000000000-create-seller-intake-tables';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://monabid:monabid@localhost:5432/monabid';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [AuctionLotEntity, SellerEntity, SellerItemEntity, ItemEvidenceEntity, ItemFactEntity, ItemRevisionEntity],
  migrations: [CreateAuctionLots1710000000000, CreateSellerIntakeTables1720000000000],
  synchronize: false,
  logging: false,
});

export default AppDataSource;
