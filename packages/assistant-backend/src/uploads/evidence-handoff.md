# Evidence Handoff

S2 exposes profile-isolated local evidence references for S1 corrections and S5 enquiry.

## API

- `GET /api/evidence/:profileId`
- `POST /api/evidence/:profileId`
- `GET /api/evidence/:profileId/:fileId`
- `PATCH /api/evidence/:profileId/order`
- `DELETE /api/evidence/:profileId/:fileId`

## EvidenceReference

```ts
interface EvidenceReference {
  fileId: string;
  originalName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  size: number;
}
```

## Durable rules

- Files are stored under the anonymous `profileId`.
- A profile cannot read, reorder, or delete another profile's evidence.
- Allowed types are JPEG, PNG, and WebP.
- Maximum file size is 10 MiB.
- Maximum files per upload is 10.
- Filenames containing `..`, `/`, or `\` are rejected.
- Evidence IDs are opaque UUIDs.
- Ordering is persisted in `evidence.json`.
- Deletion removes the file and its metadata reference.
- Tests use temporary folders and synthetic image contents.

## Normal fixture path

Using `mock-profile-week3-normal`:

1. Upload `A.jpg`, `B.jpg`, and `C.jpg`.
2. Reorder to `C.jpg`, `A.jpg`, `B.jpg`.
3. Delete `A.jpg`.
4. The remaining order is `C.jpg`, `B.jpg`.

S1 and S5 should consume the returned `EvidenceReference` objects and use the preview endpoint. They should not access `.local-storage` directly.
