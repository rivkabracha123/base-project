import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerLeadEntity } from '../database/seller-lead.entity';
import { ProfilesModule } from '../profiles/profiles.module';
import { SellerLeadsController } from './seller-leads.controller';
import { SellerLeadsService } from './seller-leads.service';

@Module({
  imports: [TypeOrmModule.forFeature([SellerLeadEntity]), ProfilesModule],
  controllers: [SellerLeadsController],
  providers: [SellerLeadsService],
})
export class SellerLeadsModule {}
