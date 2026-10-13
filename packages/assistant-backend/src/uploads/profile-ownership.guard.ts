import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { ProfilesService } from "../profiles/profiles.service";

@Injectable()
export class ProfileOwnershipGuard implements CanActivate {
  constructor(private readonly profiles: ProfilesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const profileId = request.params.profileId;
    const sessionId = request.headers["x-anonymous-session-id"];

    // The session header identifies the caller; it must not be missing or blank.
    if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
      throw new BadRequestException("Anonymous session ID is required");
    }

    // The profile ID identifies the requested resource, but is not proof of ownership.
    if (typeof profileId !== "string" || profileId.trim().length === 0) {
      throw new BadRequestException("Profile ID is required");
    }

    // Continue only when this profile belongs to the session making the request.
    // ProfilesService returns 404 for both an unknown profile and a non-owner.
    await this.profiles.getOwnedProfileEntity(sessionId, profileId);
    return true;
  }
}
