import { Module } from "@nestjs/common";
import { ProfilesModule } from "../profiles/profiles.module";
import { StorageModule } from "../storage/storage.module";
import { UploadsController } from "./uploads.controller";
import { ProfileOwnershipGuard } from "./profile-ownership.guard";
import { UploadsService } from "./uploads.service";

@Module({
  // ProfilesModule supplies the service used to verify profile/session ownership.
  imports: [StorageModule, ProfilesModule],
  controllers: [UploadsController],
  providers: [UploadsService, ProfileOwnershipGuard],
})
export class UploadsModule {}
