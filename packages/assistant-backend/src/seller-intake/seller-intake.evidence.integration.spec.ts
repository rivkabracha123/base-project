import { ConfigService } from "@nestjs/config";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalFileStorage } from "../storage/local-file-storage.service";
import { UploadsService } from "../uploads/uploads.service";
import { SellerIntakeAiMock } from "./seller-intake-ai.mock";
import { SellerIntakeService } from "./seller-intake.service";

describe("Seller intake evidence handoff", () => {
  let root: string;
  let uploads: UploadsService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "monabid-seller-intake-evidence-"));
    uploads = new UploadsService(
      new LocalFileStorage(
        new ConfigService({ LOCAL_STORAGE_PATH: root }),
      ),
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("passes S2 evidence references into the S1 draft and downstream handoff", async () => {
    const sellerIntake = new SellerIntakeService();
    const aiMock = new SellerIntakeAiMock(sellerIntake);
    const draft = aiMock.analyze("I have a painting, 60 x 80 cm, signed.");

    // The upload is item-scoped and must include itemId.
    const [reference] = await uploads.addEvidence("profile-w4", "item-1", [
      {
        originalname: "front.jpg",
        mimetype: "image/jpeg",
        size: 2048,
        buffer: Buffer.from("synthetic-image"),
      },
    ]);

    if (!reference) {
      throw new Error("S2 did not return an evidence reference");
    }

    const connectedDraft = sellerIntake.attachEvidenceReferences(
      draft,
      [reference],
    );

    const reviewedDraft = sellerIntake.linkEvidenceToFact(
      connectedDraft,
      "marks",
      [reference.fileId],
    );

    const handoff = sellerIntake.buildHandoffPayload(reviewedDraft);

    // Evidence is attached to the current profile and item only.
    expect(reviewedDraft.item.evidenceIds).toContain(reference.fileId);
    expect(reviewedDraft.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: reference.fileId,
          type: "photo",
          source: "seller-upload",
          uri: `/api/evidence/profile-w4/${reference.fileId}`,
          profileId: "profile-w4",
          previewUri: `/api/evidence/profile-w4/${reference.fileId}`,
          originalName: "front.jpg",
          mimeType: "image/jpeg",
          size: 2048,
        }),
      ]),
    );

    expect(reviewedDraft.factEvidence).toEqual({ marks: [reference.fileId] });
    expect(reviewedDraft.confirmedFacts).toEqual({});
    expect(handoff.evidence).toEqual(reviewedDraft.evidence);
    expect(handoff.factEvidence).toEqual({ marks: [reference.fileId] });

    const serialized = JSON.stringify(handoff);
    expect(serialized).not.toMatch(/phone|email|password|credential|signed.?url/i);
    expect(serialized).not.toContain("synthetic-image");
    expect(serialized).not.toContain("Private seller conversation");
  });
});