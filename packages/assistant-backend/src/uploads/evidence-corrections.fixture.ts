import type { AllowedMimeType } from "./evidence.types";

export function createCorrectionsEvidenceFixture(
  profileId: string,
  fileIds: readonly [string, string],
  itemId = "item-a",
) {
  return [
    {
      fileId: fileIds[0],
      profileId,
      itemId,
      originalName: "front.jpg",
      mimeType: "image/jpeg" as AllowedMimeType,
      size: 2048,
      previewUri: `/api/evidence/${profileId}/${fileIds[0]}`,
      downloadUri: `/api/evidence/${profileId}/${fileIds[0]}/download`,
    },
    {
      fileId: fileIds[1],
      profileId,
      itemId,
      originalName: "detail.png",
      mimeType: "image/png" as AllowedMimeType,
      size: 4096,
      previewUri: `/api/evidence/${profileId}/${fileIds[1]}`,
      downloadUri: `/api/evidence/${profileId}/${fileIds[1]}/download`,
    },
  ];
}