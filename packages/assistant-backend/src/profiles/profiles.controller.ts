import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, Patch } from '@nestjs/common';
import type { ProfileContactSnapshot, UserProfile } from '@monabid/shared';
import { ProfilesService } from './profiles.service';
import { UpdateCurrentProfileDto } from './update-current-profile.dto';
import { UpdateContactDto } from './update-contact.dto';

// Allowed session ID format: letters, digits, "-" and "_", 8-128 characters.
// Accepts UUIDs and ids like "sess-new-1", but rejects malformed or hostile values.
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

// This controller receives anonymous profile requests from the frontend.
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  // Return the profile that belongs to the current anonymous browser session.
  @Get('me')
  getCurrentProfile(
    @Headers('x-anonymous-session-id') sessionId: string,
  ): Promise<UserProfile> {
    return this.profilesService.getOrCreateBySessionId(
      this.requireSessionId(sessionId),
    );
  }

  // Privacy-safe contact contract for downstream features such as buyer help.
  @Get('me/contact-snapshot')
  getCurrentContactSnapshot(
    @Headers('x-anonymous-session-id') sessionId: string,
  ): Promise<ProfileContactSnapshot> {
    return this.profilesService.getContactSnapshotBySessionId(
      this.requireSessionId(sessionId),
    );
  }

  // Change only the language preference owned by the current anonymous session.
  @Patch('me/language')
  updateLanguage(
    @Headers('x-anonymous-session-id') sessionId: string,
    @Body('language') language: string,
  ): Promise<UserProfile> {
    return this.profilesService.updateLanguage(
      this.requireSessionId(sessionId),
      language,
    );
  }

  // Update only the profile owned by the current anonymous browser session.
  @Patch('me')
  updateCurrentProfile(
    @Headers('x-anonymous-session-id') sessionId: string,
    // Use the runtime DTO class so Nest's ValidationPipe can validate the request body.
    @Body() update: UpdateCurrentProfileDto,
  ): Promise<UserProfile> {
    return this.profilesService.updateCurrentProfile(
      this.requireSessionId(sessionId),
      update,
    );
  }

  @Patch('me/contact')
  updateContact(
    @Headers('x-anonymous-session-id') sessionId: string,
    @Body() body: UpdateContactDto,
  ): Promise<UserProfile> {
    return this.profilesService.updateContact(this.requireSessionId(sessionId), body);
  }

  // Week 5: delete the current session's profile. 204 even if none existed - idempotent for the caller.
  @Delete('me')
  @HttpCode(204)
  deleteCurrentProfile(
    @Headers('x-anonymous-session-id') sessionId: string,
  ): Promise<void> {
    return this.profilesService.deleteBySessionId(
      this.requireSessionId(sessionId),
    );
  }

  // Reject requests that cannot be tied to one anonymous browser session.
  private requireSessionId(sessionId: string | undefined): string {
    const normalizedSessionId = sessionId?.trim();

    if (!normalizedSessionId) {
      throw new BadRequestException('Anonymous session ID is required');
    }

    // The rejected value is deliberately not echoed back, so it cannot leak into responses or logs.
    if (!SESSION_ID_PATTERN.test(normalizedSessionId)) {
      throw new BadRequestException('Anonymous session ID is invalid');
    }

    return normalizedSessionId;
  }
}
