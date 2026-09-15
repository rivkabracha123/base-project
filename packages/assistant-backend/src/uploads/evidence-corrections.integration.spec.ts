import { ConfigService } from "@nestjs/config";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalFileStorage } from "../storage/local-file-storage.service";
import { UploadsService } from "./uploads.service";
import { EvidenceCorrectionsAdapter } from "./evidence-corrections.adapter";
import { createCorrectionsEvidenceFixture } from "./evidence-corrections.fixture";

describe("Evidence corrections integration", () => {
  let root: string;
  let uploadsService: UploadsService;
  let adapter: EvidenceCorrectionsAdapter;

  beforeEach(async () => {
    // Use a temporary storage folder so the test never touches real files.
    root = await mkdtemp(join(tmpdir(), "monabid-corrections-"));

    const storage = new LocalFileStorage(
      new ConfigService({
        LOCAL_STORAGE_PATH: root,
      }),
    );

    uploadsService = new UploadsService(storage);
    adapter = new EvidenceCorrectionsAdapter();
  });

  afterEach(async () => {
    // Remove all test files after each test.
    await rm(root, { recursive: true, force: true });
  });

  it("passes profile-isolated evidence references to corrections", async () => {
    const profileA = "corrections-profile-a";
    const profileB = "corrections-profile-b";

    // Profile A uploads two images.
    const evidenceA = await uploadsService.addEvidence(profileA, [
      {
        originalname: "front.jpg",
        mimetype: "image/jpeg",
        size: 2048,
        buffer: Buffer.from("profile-a-front"),
      },
      {
        originalname: "detail.png",
        mimetype: "image/png",
        size: 4096,
        buffer: Buffer.from("profile-a-detail"),
      },
    ]);

    // Profile B uploads a private image.
    const evidenceB = await uploadsService.addEvidence(profileB, [
      {
        originalname: "private.jpg",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("profile-b-private"),
      },
    ]);

    // This is the deterministic expected data for corrections.
    const fixture = createCorrectionsEvidenceFixture(profileA, [
      evidenceA[0]!.fileId,
      evidenceA[1]!.fileId,
    ]);

    // Read the references from storage, exactly as a downstream feature would.
    const storedEvidence = await uploadsService.listEvidence(profileA);

    // Convert the upload contract into the corrections contract.
    const correctionsInput = adapter.toCorrectionsInput(
      profileA,
      storedEvidence,
    );

    // Corrections receives exactly Profile A's evidence references.
    expect(correctionsInput).toEqual({
      profileId: profileA,
      evidence: fixture,
    });

    // Corrections receives metadata references, not uploaded image bytes.
    expect(correctionsInput.evidence).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          buffer: expect.anything(),
        }),
      ]),
    );

    // Corrections also must not receive a "content" field.
    expect(correctionsInput.evidence).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.anything(),
        }),
      ]),
    );

    // Each evidence reference contains the correct preview URI.
    expect(correctionsInput.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileId: evidenceA[0]!.fileId,
          profileId: profileA,
          previewUri: `/api/evidence/${profileA}/${evidenceA[0]!.fileId}`,
        }),
        expect.objectContaining({
          fileId: evidenceA[1]!.fileId,
          profileId: profileA,
          previewUri: `/api/evidence/${profileA}/${evidenceA[1]!.fileId}`,
        }),
      ]),
    );

    // Profile B's private evidence must never cross into Profile A's corrections input.
    expect(
      correctionsInput.evidence.some(
        (item) => item.fileId === evidenceB[0]!.fileId,
      ),
    ).toBe(false);
  });
});
