import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProfileEntity } from '../database/user-profile.entity';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

// Register the profile database repository, service, and HTTP controller.
@Module({
  imports: [TypeOrmModule.forFeature([UserProfileEntity])],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}