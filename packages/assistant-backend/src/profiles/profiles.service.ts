import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { UserProfile } from '@monabid/shared';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { UserProfileEntity } from '../database/user-profile.entity';
import type { UpdateCurrentProfileDto } from './update-current-profile.dto';

export type UpdateCurrentProfileInput = UpdateCurrentProfileDto;

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(UserProfileEntity)
    private readonly profiles: Repository<UserProfileEntity>,
  ) {}

  // Private helper to find or create a profile entity for the session (prevents code duplication).
  private async getOrCreateEntity(sessionId: string): Promise<UserProfileEntity> {
    let profile = await this.profiles.findOneBy({ sessionId });
    if (!profile) {
      await this.getOrCreateBySessionId(sessionId);
      profile = await this.profiles.findOneBy({ sessionId });
    }

    if (!profile) {
      throw new BadRequestException('Profile could not be created');
    }

    return profile;
  }

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
    // Get or create the profile entity before changing its saved language preference.
    const profile = await this.getOrCreateEntity(sessionId);
    // Update only the language owned by the current anonymous session.
    profile.language = language;
    const savedProfile = await this.profiles.save(profile);
    return savedProfile.toUserProfile();
  }

  async updateCurrentProfile(
    sessionId: string,
    update: UpdateCurrentProfileInput,
  ): Promise<UserProfile> {
    // Find or create the profile owned by the current anonymous browser session.
    const profile = await this.getOrCreateEntity(sessionId);
    // Accept only grammatical forms defined by the shared profile contract.
    if (
      update.grammaticalForm !== undefined &&
      !['masculine', 'feminine', 'neutral', 'unspecified'].includes(
        update.grammaticalForm,
      )
    ) {
      throw new BadRequestException('Grammatical form is not supported');
    }
    // Validate contact values before changing or saving the profile.
    if (
      update.email !== undefined &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(update.email)
    ) {
      throw new BadRequestException('Email must be valid');
    }
    if (update.phone !== undefined && update.phone.trim().length === 0) {
      throw new BadRequestException('Phone must not be empty');
    }
    // Helper function to validate consent evidence when consent is granted.
    const validateConsentEvidence = (
      consent: UpdateCurrentProfileInput['serviceConsent'],
      consentName: string,
    ) => {
      if (!consent || !consent.granted) return;
      if (consent.grantedAt !== undefined && isNaN(Date.parse(consent.grantedAt))) {
        throw new BadRequestException(`${consentName} grantedAt must be a valid ISO date-time`);
      }
      if (consent.channel !== undefined && consent.channel.trim().length === 0) {
        throw new BadRequestException(`${consentName} channel must not be empty`);
      }
      if (consent.policyVersion !== undefined && consent.policyVersion.trim().length === 0) {
        throw new BadRequestException(`${consentName} policyVersion must not be empty`);
      }
    };
    validateConsentEvidence(update.serviceConsent, 'Service consent');
    validateConsentEvidence(update.marketingConsent, 'Marketing consent');
    // Update only fields submitted in the PATCH request.
    if (update.preferredName !== undefined) {
      profile.preferredName = update.preferredName;
    }
    if (update.grammaticalForm !== undefined) {
      profile.grammaticalForm = update.grammaticalForm;
    }
    if (update.email !== undefined) {
      profile.email = update.email;
    }
    if (update.phone !== undefined) {
      profile.phone = update.phone;
    }
    // Keep service consent separate from marketing consent.
    if (update.serviceConsent !== undefined) {
      profile.serviceConsent = { ...update.serviceConsent };
    }
    if (update.marketingConsent !== undefined) {
      profile.marketingConsent = { ...update.marketingConsent };
    }
    const savedProfile = await this.profiles.save(profile);
    return savedProfile.toUserProfile();
  }
}