import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProfileEntity } from '../database/user-profile.entity';
import { StorageModule } from '../storage/storage.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

// Register the profile database repository, service, and HTTP controller.
@Module({
  imports: [TypeOrmModule.forFeature([UserProfileEntity]), StorageModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  // Exported so other modules (seller leads) can verify that a profile belongs to the caller's session.
  exports: [ProfilesService],
})
export class ProfilesModule {}