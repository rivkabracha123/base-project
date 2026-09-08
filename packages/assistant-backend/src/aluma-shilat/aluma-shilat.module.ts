// This file wires the controller and service together so NestJS knows they belong to the same feature.
import { Module } from '@nestjs/common';
import { AlomaShilatController } from './aluma-shilat.controller';
import { AlomaShilatService } from './aluma-shilat.service';

@Module({
  // External connection
  controllers: [AlomaShilatController],
  // Performs the connections
  providers: [AlomaShilatService],
})
export class AlomaShilatModule {}
