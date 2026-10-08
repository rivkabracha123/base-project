import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HttpExceptionFilter } from "../common/http-exception.filter";
import { createMockProfileId } from "../profile/mock-profile";
import { UploadsModule } from "./uploads.module";

// Boots a real NestJS app and sends real HTTP requests, unlike
// uploads.service.spec.ts which calls UploadsService directly. This is the
// layer that catches wiring bugs (e.g. a module never registered anywhere)
// that a pure unit test cannot see.
describe("UploadsModule (HTTP)", () => {
  let app: INestApplication;
  let root: string;
  let baseUrl: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "monabid-uploads-http-"));

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ LOCAL_STORAGE_PATH: root })],
        }),
        UploadsModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to get test server address");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });

  it("lets a P3 profile session upload, list, and preview isolated evidence references over the real HTTP contract", async () => {
    const profileId = createMockProfileId();

    const formData = new FormData();
    formData.append(
      "files",
      new Blob(["synthetic-image-front"], { type: "image/jpeg" }),
      "front.jpg",
    );
    formData.append(
      "files",
      new Blob(["synthetic-image-back"], { type: "image/png" }),
      "back.png",
    );

    const uploadResponse = await fetch(`${baseUrl}/evidence/${profileId}`, {
      method: "POST",
      body: formData,
    });

    expect(uploadResponse.status).toBe(201);

    const uploadBody = await uploadResponse.json();

    expect(uploadBody).toHaveLength(2);
    expect(uploadBody[0]).toMatchObject({
      originalName: "front.jpg",
      mimeType: "image/jpeg",
    });

    const listResponse = await fetch(`${baseUrl}/evidence/${profileId}`);

    expect(listResponse.status).toBe(200);

    const listBody = await listResponse.json();

    expect(listBody).toEqual(uploadBody);

    const fileId = listBody[0].fileId as string;

    const previewResponse = await fetch(
      `${baseUrl}/evidence/${profileId}/${fileId}`,
    );

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.headers.get("content-type")).toContain("image/jpeg");
  });

  it("keeps one anonymous profile session from viewing another session's evidence", async () => {
    const profileA = createMockProfileId();
    const profileB = createMockProfileId();

    const formData = new FormData();
    formData.append(
      "files",
      new Blob(["private-evidence"], { type: "image/jpeg" }),
      "private.jpg",
    );

    const uploadResponse = await fetch(`${baseUrl}/evidence/${profileA}`, {
      method: "POST",
      body: formData,
    });

    expect(uploadResponse.status).toBe(201);

    const uploadBody = await uploadResponse.json();
    const fileId = uploadBody[0].fileId as string;

    const previewResponse = await fetch(
      `${baseUrl}/evidence/${profileB}/${fileId}`,
    );

    expect(previewResponse.status).toBe(404);

    const listResponse = await fetch(`${baseUrl}/evidence/${profileB}`);

    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual([]);
  });

  it("reports an unsupported file type as an explicit client error, not a generic failure", async () => {
    const profileId = createMockProfileId();

    const formData = new FormData();
    formData.append(
      "files",
      new Blob(["not-an-image"], { type: "application/pdf" }),
      "notes.pdf",
    );

    const response = await fetch(`${baseUrl}/evidence/${profileId}`, {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(400);

    const body = await response.json();

    expect(body.message).toContain("Unsupported file type");
  });

  it("reports an oversized file as an explicit client error, not a generic failure", async () => {
    const profileId = createMockProfileId();
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);

    const formData = new FormData();
    formData.append(
      "files",
      new Blob([oversized], { type: "image/jpeg" }),
      "huge.jpg",
    );

    const response = await fetch(`${baseUrl}/evidence/${profileId}`, {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(413);

    const body = await response.json();

    expect(body.statusCode).toBe(413);
  });

  it("lets a seller upload, reorder, delete, and list evidence through the HTTP contract", async () => {
    const profileId = "mock-profile-week3-normal";

    const formData = new FormData();

    formData.append(
      "files",
      new Blob(["synthetic-image-A"], { type: "image/jpeg" }),
      "A.jpg",
    );

    formData.append(
      "files",
      new Blob(["synthetic-image-B"], { type: "image/jpeg" }),
      "B.jpg",
    );

    formData.append(
      "files",
      new Blob(["synthetic-image-C"], { type: "image/jpeg" }),
      "C.jpg",
    );

    const uploadResponse = await fetch(`${baseUrl}/evidence/${profileId}`, {
      method: "POST",
      body: formData,
    });

    expect(uploadResponse.status).toBe(201);

    const uploaded = await uploadResponse.json();

    expect(uploaded).toHaveLength(3);

    const a = uploaded[0] as { fileId: string };
    const b = uploaded[1] as { fileId: string };
    const c = uploaded[2] as { fileId: string };

    const reorderResponse = await fetch(
      `${baseUrl}/evidence/${profileId}/order`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileIds: [c.fileId, a.fileId, b.fileId],
        }),
      },
    );

    expect(reorderResponse.status).toBe(200);

    const reorderBody = await reorderResponse.json();

    expect(reorderBody.success).toBe(true);

    expect(
      reorderBody.evidence.map(
        (item: { originalName: string }) => item.originalName,
      ),
    ).toEqual(["C.jpg", "A.jpg", "B.jpg"]);

    const deleteResponse = await fetch(
      `${baseUrl}/evidence/${profileId}/${a.fileId}`,
      {
        method: "DELETE",
      },
    );

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({
      success: true,
    });

    const listResponse = await fetch(`${baseUrl}/evidence/${profileId}`);

    expect(listResponse.status).toBe(200);

    expect(
      (await listResponse.json()).map(
        (item: { originalName: string }) => item.originalName,
      ),
    ).toEqual(["C.jpg", "B.jpg"]);
  });
  it("does not let one profile delete another profile evidence", async () => {
    const profileA = "mock-profile-week3-a";
    const profileB = "mock-profile-week3-b";

    const formData = new FormData();

    formData.append(
      "files",
      new Blob(["private-evidence"], {
        type: "image/jpeg",
      }),
      "private.jpg",
    );

    const uploadResponse = await fetch(`${baseUrl}/evidence/${profileA}`, {
      method: "POST",
      body: formData,
    });

    expect(uploadResponse.status).toBe(201);

    const uploaded = await uploadResponse.json();
    const fileId = uploaded[0].fileId as string;

    const deleteResponse = await fetch(
      `${baseUrl}/evidence/${profileB}/${fileId}`,
      {
        method: "DELETE",
      },
    );

    expect(deleteResponse.status).toBe(404);

    const listResponse = await fetch(`${baseUrl}/evidence/${profileA}`);

    expect(await listResponse.json()).toHaveLength(1);
  });
  it("reports invalid reorder input as an explicit client error", async () => {
    const response = await fetch(
      `${baseUrl}/evidence/mock-profile-week3-normal/order`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileIds: "not-an-array",
        }),
      },
    );

    expect(response.status).toBe(400);

    const body = await response.json();

    expect(body.message).toContain("fileIds must be an array of strings");
  });
  it("rejects an unsafe filename over HTTP", async () => {
    const profileId = "mock-profile-unsafe-name";
    const formData = new FormData();

    formData.append(
      "files",
      new Blob(["synthetic-image"], { type: "image/jpeg" }),
      "photo..jpg",
    );

    const response = await fetch(`${baseUrl}/evidence/${profileId}`, {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(400);

    const body = await response.json();

    expect(body.message).toContain("Unsafe filename");
  });

  it("returns not found when deleting an unknown evidence id", async () => {
    const response = await fetch(
      `${baseUrl}/evidence/mock-profile-week3-normal/unknown-file-id`,
      {
        method: "DELETE",
      },
    );

    expect(response.status).toBe(404);

    const body = await response.json();

    expect(body.message).toContain("Evidence not found");
  });

  it("does not reorder evidence from another profile", async () => {
    const profileA = "mock-profile-order-a";
    const profileB = "mock-profile-order-b";

    const formData = new FormData();

    formData.append(
      "files",
      new Blob(["private-image"], { type: "image/jpeg" }),
      "private.jpg",
    );

    const uploadResponse = await fetch(`${baseUrl}/evidence/${profileA}`, {
      method: "POST",
      body: formData,
    });

    expect(uploadResponse.status).toBe(201);

    const uploaded = await uploadResponse.json();
    const foreignFileId = uploaded[0].fileId as string;

    const profileBFormData = new FormData();

    profileBFormData.append(
      "files",
      new Blob(["profile-b-image"], { type: "image/jpeg" }),
      "profile-b.jpg",
    );

    const profileBUploadResponse = await fetch(
      `${baseUrl}/evidence/${profileB}`,
      {
        method: "POST",
        body: profileBFormData,
      },
    );

    expect(profileBUploadResponse.status).toBe(201);

    const reorderResponse = await fetch(
      `${baseUrl}/evidence/${profileB}/order`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileIds: [foreignFileId],
        }),
      },
    );

    expect(reorderResponse.status).toBe(404);

    const body = await reorderResponse.json();

    expect(body.message).toContain("Evidence not found");
  });
});
