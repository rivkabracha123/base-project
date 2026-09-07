import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { UserProfile } from '@monabid/shared';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { UserProfileEntity } from '../database/user-profile.entity';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(UserProfileEntity)
    private readonly profiles: Repository<UserProfileEntity>,
  ) {}

  async getOrCreateBySessionId(sessionId: string): Promise<UserProfile> {
    // Search for the profile owned by this anonymous browser session.
    const existingProfile = await this.profiles.findOneBy({ sessionId });

    // Reuse the saved profile so the same session never receives a duplicate.
    if (existingProfile) {
      return existingProfile.toUserProfile();
    }

    // New anonymous profiles start in Hebrew by the team's product decision.
    const newProfile = this.profiles.create({
      id: randomUUID(),
      sessionId,
      language: 'he',
      serviceConsent: { granted: false },
      marketingConsent: { granted: false },
    });

    // Save the profile so it can be restored when the visitor returns.
    const savedProfile = await this.profiles.save(newProfile);
    return savedProfile.toUserProfile();
  }

  async updateLanguage(sessionId: string, language: string): Promise<UserProfile> {
    // The reduced-cycle product supports Hebrew and English only.
    if (language !== 'he' && language !== 'en') {
      throw new BadRequestException('Language must be either he or en');
    }

    // Get or create the profile before changing its saved language preference.
    let profile = await this.profiles.findOneBy({ sessionId });
    if (!profile) {
      await this.getOrCreateBySessionId(sessionId);
      profile = await this.profiles.findOneBy({ sessionId });
    }

    if (!profile) {
      throw new BadRequestException('Profile could not be created');
    }

    // Update only the language owned by the current anonymous session.
    profile.language = language;
    const savedProfile = await this.profiles.save(profile);
    return savedProfile.toUserProfile();
  }
}