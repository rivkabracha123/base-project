import type { EvidenceReference } from "./evidence.types";
import type { CorrectionsEvidenceInput } from "./evidence-corrections.types";

export class EvidenceCorrectionsAdapter {
  toCorrectionsInput(
    profileId: string,
    evidence: readonly EvidenceReference[],
  ): CorrectionsEvidenceInput {
    return {
      profileId,
      evidence: [...evidence],
    };
  }
}