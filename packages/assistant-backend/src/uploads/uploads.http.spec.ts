import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HttpExceptionFilter } from "../common/http-exception.filter";
import { createMockProfileId } from "../profile/mock-profile";
import { UploadsModule } from "./uploads.module";

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
    const itemId = "item-1";

    const formData = new FormData();
    formData.append("files", new Blob(["front"], { type: "image/jpeg" }), "front.jpg");
    formData.append("files", new Blob(["back"], { type: "image/png" }), "back.png");

    const uploadResponse = await fetch(
      `${baseUrl}/evidence/${profileId}/items/${itemId}`,
      {
        method: "POST",
        body: formData,
      },
    );

    expect(uploadResponse.status).toBe(201);

    const uploadBody = await uploadResponse.json();

    expect(uploadBody).toHaveLength(2);
    expect(uploadBody[0]).toMatchObject({
      originalName: "front.jpg",
      mimeType: "image/jpeg",
    });

    const listResponse = await fetch(`${baseUrl}/evidence/${profileId}?itemId=${itemId}`);
    expect(listResponse.status).toBe(200);

    const listBody = await listResponse.json();
    expect(listBody).toEqual(uploadBody);

    const fileId = listBody[0].fileId as string;
    const previewResponse = await fetch(`${baseUrl}/evidence/${profileId}/${fileId}`);

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.headers.get("content-type")).toContain("image/jpeg");
  });

  it("keeps one anonymous profile session from viewing another session's evidence", async () => {
    const profileA = createMockProfileId();
    const profileB = createMockProfileId();
    const itemA = "item-a";

    const formData = new FormData();
    formData.append(
      "files",
      new Blob(["private-evidence"], { type: "image/jpeg" }),
      "private.jpg",
    );

    const uploadResponse = await fetch(
      `${baseUrl}/evidence/${profileA}/items/${itemA}`,
      {
        method: "POST",
        body: formData,
      },
    );

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
    const itemId = "item-unsupported";

    const formData = new FormData();
    formData.append(
      "files",
      new Blob(["not-an-image"], { type: "application/pdf" }),
      "notes.pdf",
    );

    const response = await fetch(
      `${baseUrl}/evidence/${profileId}/items/${itemId}`,
      { method: "POST", body: formData },
    );

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.message).toContain("Unsupported file type");
  });

  it("reports an oversized file as an explicit client error, not a generic failure", async () => {
    const profileId = createMockProfileId();
    const itemId = "item-large";

    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);

    const formData = new FormData();
    formData.append(
      "files",
      new Blob([oversized], { type: "image/jpeg" }),
      "huge.jpg",
    );

    const response = await fetch(
      `${baseUrl}/evidence/${profileId}/items/${itemId}`,
      { method: "POST", body: formData },
    );

    expect(response.status).toBe(413);

    const body = await response.json();
    expect(body.statusCode).toBe(413);
  });

  it("lets a seller upload, reorder, delete, and list evidence through the HTTP contract", async () => {
    const profileId = "mock-profile-week3-normal";
    const itemId = "item-1";

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

    const uploadResponse = await fetch(
      `${baseUrl}/evidence/${profileId}/items/${itemId}`,
      { method: "POST", body: formData },
    );

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
        headers: { "Content-Type": "application/json" },
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
      { method: "DELETE" },
    );

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ success: true });

    const listResponse = await fetch(`${baseUrl}/evidence/${profileId}?itemId=${itemId}`);
    expect(listResponse.status).toBe(200);

    expect(
      (await listResponse.json()).map(
        (item: { originalName: string }) => item.originalName,
      ),
    ).toEqual(["C.jpg", "B.jpg"]);
  });

  it("does not let one profile delete another profile evidence", async () => {
    const profileA = createMockProfileId();
    const profileB = createMockProfileId();
    const itemA = "item-a";

    const formData = new FormData();
    formData.append(
      "files",
      new Blob(["private"], { type: "image/jpeg" }),
      "private.jpg",
    );

    const uploadResponse = await fetch(
      `${baseUrl}/evidence/${profileA}/items/${itemA}`,
      { method: "POST", body: formData },
    );

    expect(uploadResponse.status).toBe(201);

    const uploaded = await uploadResponse.json();
    const fileId = uploaded[0].fileId as string;

    const deleteResponse = await fetch(
      `${baseUrl}/evidence/${profileB}/${fileId}`,
      { method: "DELETE" },
    );

    expect(deleteResponse.status).toBe(404);
  });

  it("rejects an unsafe filename over HTTP", async () => {
    const profileId = createMockProfileId();
    const itemId = "item-unsafe";

    const formData = new FormData();
    formData.append(
      "files",
      new Blob(["unsafe"], { type: "image/jpeg" }),
      "unsafe..jpg",
    );

    const response = await fetch(
      `${baseUrl}/evidence/${profileId}/items/${itemId}`,
      { method: "POST", body: formData },
    );

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.message).toContain("Unsafe filename");
  });

  it("does not reorder evidence from another profile", async () => {
    const profileA = createMockProfileId();
    const profileB = createMockProfileId();
    const itemA = "item-a";
    const itemB = "item-b";

    const uploadA = new FormData();
    uploadA.append(
      "files",
      new Blob(["profile-a"], { type: "image/jpeg" }),
      "A.jpg",
    );

    const upA = await fetch(`${baseUrl}/evidence/${profileA}/items/${itemA}`, {
      method: "POST",
      body: uploadA,
    });

    expect(upA.status).toBe(201);

    const uploadB = new FormData();
    uploadB.append(
      "files",
      new Blob(["profile-b"], { type: "image/jpeg" }),
      "B.jpg",
    );

    const upB = await fetch(`${baseUrl}/evidence/${profileB}/items/${itemB}`, {
      method: "POST",
      body: uploadB,
    });

    expect(upB.status).toBe(201);

    const uploadedA = await upA.json();
    const fileIdA = uploadedA[0].fileId as string;

    const reorderResponse = await fetch(
      `${baseUrl}/evidence/${profileB}/order`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileIds: [fileIdA],
        }),
      },
    );

    // Cross-profile reorder must fail with 404 because the profile has no evidence.
    expect(reorderResponse.status).toBe(404);
  });
});