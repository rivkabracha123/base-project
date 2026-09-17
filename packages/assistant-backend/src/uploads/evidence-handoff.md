# Evidence Handoff

S2 exposes profile-isolated item evidence references for S1 corrections and S5 enquiry.

## API

- `POST /api/evidence/:profileId/items/:itemId`
- `GET /api/evidence/:profileId`
- `GET /api/evidence/:profileId/items/:itemId`
- `GET /api/evidence/:profileId/:fileId`
- `GET /api/evidence/:profileId/:fileId/download`
- `PATCH /api/evidence/:profileId/order`
- `DELETE /api/evidence/:profileId/:fileId`

## EvidenceReference

```ts
interface EvidenceReference {
  fileId: string;
  profileId: string;
  itemId: string;
  originalName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  size: number;
  previewUri: string;
  downloadUri: string;
}
```

## Durable rules

Files are stored under the anonymous profileId.
A profile cannot read, reorder, or delete another profile's evidence.
Each itemId belongs to a single item record and may only be uploaded once.
Upload is attached to profileId + itemId.
Allowed types are JPEG, PNG, and WebP.
Maximum file size is 10 MiB.
Maximum files per upload is 10.
Filenames containing .., /, or \ are rejected.
Evidence IDs are opaque UUIDs.
previewUri is the backend preview endpoint for the same profileId and fileId.
downloadUri is the backend download endpoint for the same profileId and fileId.
Ordering is persisted in evidence.json.
Deletion removes the file and its metadata reference.
Tests use temporary folders and synthetic image contents.

## Upload contract

`itemId` must already exist before the upload call.

### Example

```http
POST /api/evidence/profile-123/items/item-456
Content-Type: multipart/form-data
```

Body:
```text
files=@front.jpg
files=@back.png
```

Response:
```json
[
  {
    "fileId": "uuid-1",
    "profileId": "profile-123",
    "itemId": "item-456",
    "originalName": "front.jpg",
    "mimeType": "image/jpeg",
    "size": 123456,
    "previewUri": "/api/evidence/profile-123/uuid-1",
    "downloadUri": "/api/evidence/profile-123/uuid-1/download"
  }
]
```

If the same item is uploaded again, the server rejects the request with a `400` error.

## Listing

- `GET /api/evidence/:profileId` returns all evidence for that profile.
- `GET /api/evidence/:profileId/items/:itemId` returns only the evidence for that item.

## Normal fixture path

Using `mock-profile-week3-normal`:

1. Create item `item-1`.
2. Upload `A.jpg`, `B.jpg`, and `C.jpg` for `item-1`.
3. Reorder to `C.jpg`, `A.jpg`, `B.jpg`.
4. Delete `A.jpg`.
5. The remaining order is `C.jpg`, `B.jpg`.

S1 and S5 should consume the returned `EvidenceReference` objects and use the preview/download endpoints. They should not access `.local-storage` directly.

