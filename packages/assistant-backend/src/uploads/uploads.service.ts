import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { LocalFileStorage } from "../storage/local-file-storage.service";
import { ALLOWED_MIME_TYPES, EVIDENCE_METADATA_FILE, MAX_FILE_SIZE_BYTES, MAX_FILES_PER_UPLOAD, AllowedMimeType, EvidenceReference, UploadedFile } from "./evidence.types";

@Injectable()
export class UploadsService {
  constructor(private readonly storage: LocalFileStorage) {}

  async listEvidence(profileId: string): Promise<EvidenceReference[]> {
    try {
      const raw = await this.storage.read(profileId, EVIDENCE_METADATA_FILE);
      return JSON.parse(raw.toString("utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
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
      throw new BadRequestException("Too many files");
    }

    for (const file of files) {
      if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
        throw new BadRequestException("Unsupported file type");
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new PayloadTooLargeException("File too large");
      }

      if (file.originalname.includes("..") || /[/\\]/.test(file.originalname)) {
        throw new BadRequestException("Unsafe filename");
      }
    }

    const evidence: EvidenceReference[] = [];

    try {
      // Persist all files before updating metadata so a failed upload cannot leave a partial gallery.
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

      // Remove files written during this request to keep storage consistent after a partial failure.
    } catch (error) {
      await Promise.all(
        evidence.map((item) =>
          this.storage.delete(profileId, item.fileId).catch(() => undefined),
        ),
      );

      throw error;
    }
  }

  async readImage(
    profileId: string,
    fileId: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const items = await this.listEvidence(profileId);
    const item = items.find((entry) => entry.fileId === fileId);

    if (!item) {
      throw new NotFoundException("Evidence not found");
    }

    const buffer = await this.storage.read(profileId, fileId);

    return {
      buffer,
      mimeType: item.mimeType,
    };
  }

  // Rebuild the evidence list from validated IDs to preserve the requested order safely.
  async reorderEvidence(
    profileId: string,
    fileIds: string[],
  ): Promise<EvidenceReference[]> {
    const existing = await this.listEvidence(profileId);

    if (fileIds.length !== existing.length) {
      throw new BadRequestException("Incomplete evidence list");
    }

    if (new Set(fileIds).size !== fileIds.length) {
      throw new BadRequestException("Duplicate evidence id");
    }

    const existingIds = new Set(existing.map((item) => item.fileId));

    for (const fileId of fileIds) {
      if (!existingIds.has(fileId)) {
        throw new NotFoundException("Evidence not found");
      }
    }

    const reordered = fileIds.map((fileId) =>
      existing.find((item) => item.fileId === fileId)!,
    );

    await this.storage.write(
      profileId,
      EVIDENCE_METADATA_FILE,
      Buffer.from(JSON.stringify(reordered)),
    );

    return reordered;
  }

  async deleteEvidence(profileId: string, fileId: string): Promise<void> {
    const existing = await this.listEvidence(profileId);

    const item = existing.find((entry) => entry.fileId === fileId);

    if (!item) {
      throw new NotFoundException("Evidence not found");
    }

    const contents = await this.storage.read(profileId, fileId);

    await this.storage.delete(profileId, fileId);

    const remaining = existing.filter((entry) => entry.fileId !== fileId);

    // Restore the deleted file if metadata persistence fails, keeping the file and metadata in sync.
    try {
      await this.storage.write(
        profileId,
        EVIDENCE_METADATA_FILE,
        Buffer.from(JSON.stringify(remaining)),
      );
    } catch (error) {
      await this.storage
        .write(profileId, fileId, contents)
        .catch(() => undefined);

      throw error;
    }
  }
}
