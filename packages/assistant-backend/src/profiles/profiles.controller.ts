import { BadRequestException, Body, Controller, Get, Headers, Patch } from '@nestjs/common';
import type { UserProfile } from '@monabid/shared';
import { ProfilesService } from './profiles.service';

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

  // Reject requests that cannot be tied to one anonymous browser session.
  private requireSessionId(sessionId: string | undefined): string {
    if (!sessionId) {
      throw new BadRequestException('Anonymous session ID is required');
    }

    return sessionId;
  }
}