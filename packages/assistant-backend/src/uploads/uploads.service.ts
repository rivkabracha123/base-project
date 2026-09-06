import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LocalFileStorage } from '../storage/local-file-storage.service';
import {
  ALLOWED_MIME_TYPES,
  EVIDENCE_METADATA_FILE,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_UPLOAD,
  AllowedMimeType,
  EvidenceReference,
  UploadedFile,
} from './evidence.types';

@Injectable()
export class UploadsService {
  constructor(private readonly storage: LocalFileStorage) {}

  async listEvidence(profileId: string): Promise<EvidenceReference[]> {
    try {
      const raw = await this.storage.read(profileId, EVIDENCE_METADATA_FILE);
      return JSON.parse(raw.toString('utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async addEvidence(
    profileId: string,
    files: UploadedFile[],
  ): Promise<EvidenceReference[]> {
    if (files.length > MAX_FILES_PER_UPLOAD) {
      throw new BadRequestException('Too many files');
    }

    // Validate the whole batch before writing anything, so one bad file
    // rejects the upload instead of leaving a partial result on disk.
    for (const file of files) {
      if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
        throw new BadRequestException('Unsupported file type');
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new PayloadTooLargeException('File too large');
      }

      // originalname is untrusted client input; the file itself is stored
      // under a random UUID regardless, but a traversal-shaped name is
      // still rejected outright rather than silently accepted.
      if (file.originalname.includes('..') || /[/\\]/.test(file.originalname)) {
        throw new BadRequestException('Unsafe filename');
      }
    }

    const evidence: EvidenceReference[] = [];

    for (const file of files) {
      const fileId = randomUUID();

      await this.storage.write(profileId, fileId, file.buffer);

      evidence.push({
        fileId,
        originalName: file.originalname,
        mimeType: file.mimetype as AllowedMimeType,
        size: file.size,
      });
    }

    const existing = await this.listEvidence(profileId);

    await this.storage.write(
      profileId,
      EVIDENCE_METADATA_FILE,
      Buffer.from(JSON.stringify([...existing, ...evidence])),
    );

    return [...existing, ...evidence];
  }

  async readImage(
    profileId: string,
    fileId: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    // fileId is resolved against this profile's own index first — this is
    // what prevents one profile from reading another profile's file, even
    // given a valid fileId that belongs to someone else.
    const items = await this.listEvidence(profileId);
    const item = items.find((entry) => entry.fileId === fileId);

    if (!item) {
      throw new NotFoundException('Evidence not found');
    }

    const buffer = await this.storage.read(profileId, fileId);

    return { buffer, mimeType: item.mimeType };
  }
}