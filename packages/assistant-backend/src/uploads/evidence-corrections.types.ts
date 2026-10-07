import type { AllowedMimeType } from "./evidence.types";

export interface CorrectionsEvidenceInput {
  profileId: string;
  evidence: readonly {
    fileId: string;
    profileId: string;
    originalName: string;
    mimeType: AllowedMimeType;
    size: number;
    previewUri: string;
  }[];
}
