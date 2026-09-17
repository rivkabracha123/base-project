import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { LocalFileStorage } from "../storage/local-file-storage.service";
import { ALLOWED_MIME_TYPES, EVIDENCE_METADATA_FILE, MAX_FILE_SIZE_BYTES, MAX_FILES_PER_UPLOAD, AllowedMimeType, EvidenceReference, UploadedFile } from "./evidence.types";

@Injectable()
export class UploadsService {
  constructor(private readonly storage: LocalFileStorage) {}

  async listEvidence(
    profileId: string,
    itemId?: string,
  ): Promise<EvidenceReference[]> {
    try {
      const raw = await this.storage.read(profileId, EVIDENCE_METADATA_FILE);
      const entries = JSON.parse(raw.toString("utf8")) as EvidenceReference[];

      if (!itemId) {
        return entries;
      }

      return entries.filter((entry) => entry.itemId === itemId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }

      throw error;
    }
  }

  async addEvidence(
    profileId: string,
    itemId: string,
    files: UploadedFile[],
  ): Promise<EvidenceReference[]> {
    if (!itemId || itemId.trim().length === 0) {
      throw new BadRequestException("itemId is required");
    }

    const existing = await this.listEvidence(profileId);

    // One upload batch per item is the required business rule.
    if (existing.some((entry) => entry.itemId === itemId)) {
      throw new BadRequestException("This item already has uploaded evidence");
    }

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
      for (const file of files) {
        const fileId = randomUUID();

        await this.storage.write(profileId, fileId, file.buffer);

        evidence.push({
          fileId,
          profileId,
          itemId,
          originalName: file.originalname,
          mimeType: file.mimetype as AllowedMimeType,
          size: file.size,
          previewUri: `/api/evidence/${encodeURIComponent(profileId)}/${encodeURIComponent(fileId)}`,
          downloadUri: `/api/evidence/${encodeURIComponent(profileId)}/${encodeURIComponent(fileId)}/download`,
        });
      }

      await this.storage.write(
        profileId,
        EVIDENCE_METADATA_FILE,
        Buffer.from(JSON.stringify([...existing, ...evidence])),
      );

      return [...existing, ...evidence];
    } catch (error) {
      // Keep storage consistent if a later write fails after some files were already written.
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
    includeOriginalName = false,
  ): Promise<{ buffer: Buffer; mimeType: string; originalName?: string }> {
    const items = await this.listEvidence(profileId);
    const item = items.find((entry) => entry.fileId === fileId);

    if (!item) {
      throw new NotFoundException("Evidence not found");
    }

    const buffer = await this.storage.read(profileId, fileId);

    return {
      buffer,
      mimeType: item.mimeType,
      originalName: includeOriginalName ? item.originalName : undefined,
    };
  }

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

    try {
      await this.storage.write(
        profileId,
        EVIDENCE_METADATA_FILE,
        Buffer.from(JSON.stringify(remaining)),
      );
    } catch (error) {
      // Restore the deleted file if metadata persistence fails so the storage stays consistent.
      await this.storage
        .write(profileId, fileId, contents)
        .catch(() => undefined);

      throw error;
    }
  }
}