import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerLeadEntity } from '../database/seller-lead.entity';
import { SellerLeadsController } from './seller-leads.controller';
import { SellerLeadsService } from './seller-leads.service';

@Module({
  imports: [TypeOrmModule.forFeature([SellerLeadEntity])],
  controllers: [SellerLeadsController],
  providers: [SellerLeadsService],
  exports: [SellerLeadsService],
})
export class SellerLeadsModule {}
