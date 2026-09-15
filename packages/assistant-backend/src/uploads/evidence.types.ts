import type { SellerEvidenceReference } from "@monabid/shared";

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;

export const EVIDENCE_METADATA_FILE = "evidence.json";

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
export type EvidenceReference = SellerEvidenceReference;

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
