import { Module } from '@nestjs/common';
import { AlomaShilatController } from './aluma-shilat.controller';
import { AlomaShilatService } from './aluma-shilat.service';

@Module({
  controllers: [AlomaShilatController],
  providers: [AlomaShilatService],
})
export class AlomaShilatModule {}
