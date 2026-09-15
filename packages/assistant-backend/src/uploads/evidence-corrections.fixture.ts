import type { AllowedMimeType } from "./evidence.types";

export function createCorrectionsEvidenceFixture(
  profileId: string,
  fileIds: readonly [string, string],
) {
  return [
    {
      fileId: fileIds[0],
      profileId,
      originalName: "front.jpg",
      mimeType: "image/jpeg" as AllowedMimeType,
      size: 2048,
      previewUri: `/api/evidence/${profileId}/${fileIds[0]}`,
    },
    {
      fileId: fileIds[1],
      profileId,
      originalName: "detail.png",
      mimeType: "image/png" as AllowedMimeType,
      size: 4096,
      previewUri: `/api/evidence/${profileId}/${fileIds[1]}`,
    },
  ];
}
