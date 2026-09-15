import type { EvidenceReference } from "./evidence.types";

export interface CorrectionsEvidenceInput {
  profileId: string;
  evidence: readonly EvidenceReference[];
}