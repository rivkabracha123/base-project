import type { EvidenceReference } from "./evidence.types";

export function createCorrectionsEvidenceFixture(
  fileIds: readonly [string, string],
): EvidenceReference[] {
  return [
    {
      fileId: fileIds[0],
      originalName: "front.jpg",
      mimeType: "image/jpeg",
      size: 2048,
    },
    {
      fileId: fileIds[1],
      originalName: "detail.png",
      mimeType: "image/png",
      size: 4096,
    },
  ];
}