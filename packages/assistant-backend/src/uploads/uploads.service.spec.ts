import { ConfigService } from "@nestjs/config";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalFileStorage } from "../storage/local-file-storage.service";
import { EVIDENCE_METADATA_FILE } from "./evidence.types";
import { UploadsService } from "./uploads.service";

describe("UploadsService", () => {
  let root: string;
  let storage: LocalFileStorage;
  let service: UploadsService;

  const createImage = (
    originalname: string,
    mimetype = "image/jpeg",
    size = 1024,
    content = "synthetic-image",
  ) => ({
    originalname,
    mimetype,
    size,
    buffer: Buffer.from(content),
  });

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "monabid-uploads-"));

    storage = new LocalFileStorage(
      new ConfigService({
        LOCAL_STORAGE_PATH: root,
      }),
    );

    service = new UploadsService(storage);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe("uploading images", () => {
    it("starts with an empty gallery for a profile with no evidence", async () => {
      const result = await service.listEvidence("profile-a");

      expect(result).toEqual([]);
    });

    it("stores a single uploaded image and returns it in the gallery", async () => {
      const result = await service.addEvidence("profile-a", "item-1", [
        createImage("front.jpg"),
      ]);

      expect(result).toHaveLength(1);
    });

    it("returns the mime type together with the image bytes", async () => {
      const [item] = await service.addEvidence("profile-a", "item-1", [
        createImage("front.jpg", "image/jpeg"),
      ]);

      const result = await service.readImage("profile-a", item!.fileId);

      expect(result.mimeType).toBe("image/jpeg");
    });

    it("stores multiple images from a single upload call", async () => {
      const result = await service.addEvidence("profile-a", "item-1", [
        createImage("front.jpg"),
        createImage("back.png", "image/png"),
        createImage("side.webp", "image/webp"),
      ]);

      expect(result).toHaveLength(3);
    });

    it("preserves the original filename and mime type as metadata", async () => {
      const result = await service.addEvidence("profile-a", "item-1", [
        createImage("front.jpg", "image/jpeg"),
      ]);

      expect(result[0]).toMatchObject({
        originalName: "front.jpg",
        mimeType: "image/jpeg",
      });
    });

    it("returns a preview reference that can be used to fetch the image", async () => {
      const [item] = await service.addEvidence("profile-a", "item-1", [
        createImage("front.jpg", "image/jpeg", 1024, "synthetic-image-content"),
      ]);

      const { buffer } = await service.readImage("profile-a", item!.fileId);

      expect(buffer.toString()).toBe("synthetic-image-content");
    });
  });

  describe("upload completion callback", () => {
    it("calls the callback once after the evidence and metadata are stored", async () => {
      const events: string[] = [];
      const originalWrite = storage.write.bind(storage);
      const write = jest.spyOn(storage, "write");

      write.mockImplementation(async (profileId, fileId, contents) => {
        await originalWrite(profileId, fileId, contents);
        events.push(
          fileId === EVIDENCE_METADATA_FILE ? "metadata-written" : "file-written",
        );
      });

      const onComplete = jest.fn((result: { success: boolean }) => {
        events.push(result.success ? "callback-success" : "callback-failure");
      });

      const result = await service.addEvidence(
        "profile-a",
        "item-1",
        [createImage("front.jpg")],
        onComplete,
      );

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith({
        success: true,
        evidence: result,
      });
      expect(events).toEqual([
        "file-written",
        "metadata-written",
        "callback-success",
      ]);
      await expect(service.listEvidence("profile-a")).resolves.toEqual(result);
    });

    it("calls the callback once with a validation failure", async () => {
      const onComplete = jest.fn();

      await expect(
        service.addEvidence(
          "profile-a",
          "item-1",
          [createImage("notes.pdf", "application/pdf")],
          onComplete,
        ),
      ).rejects.toThrow("Unsupported file type");

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith({
        success: false,
        error: "Unsupported file type",
      });
      await expect(service.listEvidence("profile-a")).resolves.toEqual([]);
    });

    it("calls the callback once with a storage failure", async () => {
      const onComplete = jest.fn();
      jest.spyOn(storage, "write").mockRejectedValueOnce(
        new Error("Storage failure"),
      );

      await expect(
        service.addEvidence(
          "profile-a",
          "item-1",
          [createImage("front.jpg")],
          onComplete,
        ),
      ).rejects.toThrow("Storage failure");

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith({
        success: false,
        error: "Storage failure",
      });
      await expect(service.listEvidence("profile-a")).resolves.toEqual([]);
    });
  });

  describe("file safety", () => {
    it.each([
      ["image/jpeg", "photo.jpg"],
      ["image/png", "photo.png"],
      ["image/webp", "photo.webp"],
    ])("accepts allowed image type %s", async (mimeType, fileName) => {
      const result = await service.addEvidence("profile-a", "item-1", [
        createImage(fileName, mimeType),
      ]);

      expect(result).toHaveLength(1);
    });

    it("rejects uploads with more files than the maximum allowed", async () => {
      const files = Array.from({ length: 11 }, (_, i) =>
        createImage(`photo-${i}.jpg`),
      );

      await expect(
        service.addEvidence("profile-a", "item-1", files),
      ).rejects.toThrow("Too many files");
    });

    it("does not save any files if one of them fails validation", async () => {
      const write = jest.spyOn(storage, "write");

      await expect(
        service.addEvidence("profile-a", "item-1", [
          createImage("good.jpg"),
          createImage("bad.pdf", "application/pdf"),
        ]),
      ).rejects.toThrow("Unsupported file type");

      expect(write).not.toHaveBeenCalled();
    });

    it("rejects unsupported file types", async () => {
      await expect(
        service.addEvidence("profile-a", "item-1", [
          createImage("document.pdf", "application/pdf"),
        ]),
      ).rejects.toThrow();
    });

    it("rejects files larger than the maximum allowed size", async () => {
      const tooLarge = 10 * 1024 * 1024 + 1;

      await expect(
        service.addEvidence("profile-a", "item-1", [
          createImage("huge.jpg", "image/jpeg", tooLarge),
        ]),
      ).rejects.toThrow();
    });

    it("rejects unsafe filenames", async () => {
      await expect(
        service.addEvidence("profile-a", "item-1", [
          createImage("../../outside.jpg"),
        ]),
      ).rejects.toThrow();
    });

    it("accepts filenames with spaces and non-English characters", async () => {
      const result = await service.addEvidence("profile-a", "item-1", [
        createImage("תמונה 1.jpg"),
      ]);

      expect(result).toHaveLength(1);
    });
  });

  describe("profile isolation", () => {
    it("keeps same-named files separate between profiles", async () => {
      const [itemA] = await service.addEvidence("profile-a", "item-a", [
        createImage("photo.jpg", "image/jpeg", 1024, "profile-a"),
      ]);

      const [itemB] = await service.addEvidence("profile-b", "item-b", [
        createImage("photo.jpg", "image/jpeg", 1024, "profile-b"),
      ]);

      const resultA = await service.readImage("profile-a", itemA!.fileId);
      const resultB = await service.readImage("profile-b", itemB!.fileId);

      expect(resultA.buffer.toString()).toBe("profile-a");
      expect(resultB.buffer.toString()).toBe("profile-b");
    });

    it("prevents one profile from reading another profile file", async () => {
      const [item] = await service.addEvidence("profile-a", "item-1", [
        createImage("private.jpg", "image/jpeg", 1024, "private"),
      ]);

      await expect(
        service.readImage("profile-b", item!.fileId),
      ).rejects.toThrow();
    });
  });

  describe("storage failures", () => {
    it("does not leave partial metadata when storage fails", async () => {
      const write = jest.spyOn(storage, "write");

      write.mockRejectedValueOnce(new Error("Storage failure"));

      await expect(
        service.addEvidence("profile-a", "item-1", [
          createImage("front.jpg"),
          createImage("back.jpg"),
        ]),
      ).rejects.toThrow("Storage failure");

      await expect(service.listEvidence("profile-a")).resolves.toEqual([]);
    });

    it("propagates unexpected errors instead of treating them as empty", async () => {
      const read = jest.spyOn(storage, "read");

      read.mockRejectedValueOnce(new Error("Disk corrupted"));

      await expect(service.listEvidence("profile-a")).rejects.toThrow(
        "Disk corrupted",
      );
    });

    it("cleans up already-written files when a later upload write fails", async () => {
      const originalWrite = storage.write.bind(storage);
      let imageWrites = 0;

      const write = jest.spyOn(storage, "write");

      write.mockImplementation(async (profileId, fileId, contents) => {
        if (fileId !== EVIDENCE_METADATA_FILE) {
          imageWrites += 1;

          if (imageWrites === 2) {
            throw new Error("Storage failure");
          }
        }

        return originalWrite(profileId, fileId, contents);
      });

      await expect(
        service.addEvidence("profile-a", "item-1", [
          createImage("front.jpg"),
          createImage("back.jpg"),
        ]),
      ).rejects.toThrow("Storage failure");

      await expect(service.listEvidence("profile-a")).resolves.toEqual([]);
    });
  });

  describe("evidence contract", () => {
    it("returns evidence references with the required metadata", async () => {
      const [item] = await service.addEvidence("profile-a", "item-1", [
        createImage("front.jpg", "image/jpeg", 2048),
      ]);

      expect(item).toEqual({
        fileId: expect.any(String),
        profileId: "profile-a",
        itemId: "item-1",
        originalName: "front.jpg",
        mimeType: "image/jpeg",
        size: 2048,
        previewUri: expect.stringMatching(/^\/api\/evidence\/profile-a\//),
        downloadUri: expect.stringMatching(
          /^\/api\/evidence\/profile-a\/.*\/download$/,
        ),
      });
    });
  });

  describe("ordering", () => {
    it("changes the order of evidence", async () => {
      const evidence = await service.addEvidence("profile-a", "item-1", [
        createImage("A.jpg"),
        createImage("B.jpg"),
        createImage("C.jpg"),
      ]);

      const reordered = await service.reorderEvidence("profile-a", [
        evidence[2]!.fileId,
        evidence[0]!.fileId,
        evidence[1]!.fileId,
      ]);

      expect(reordered.map((item) => item.originalName)).toEqual([
        "C.jpg",
        "A.jpg",
        "B.jpg",
      ]);
    });

    it("persists the new evidence order", async () => {
      const evidence = await service.addEvidence("profile-a", "item-1", [
        createImage("A.jpg"),
        createImage("B.jpg"),
        createImage("C.jpg"),
      ]);

      await service.reorderEvidence("profile-a", [
        evidence[2]!.fileId,
        evidence[0]!.fileId,
        evidence[1]!.fileId,
      ]);

      const result = await service.listEvidence("profile-a");

      expect(result.map((item) => item.originalName)).toEqual([
        "C.jpg",
        "A.jpg",
        "B.jpg",
      ]);
    });

    it("rejects an unknown evidence id during reorder", async () => {
      const evidence = await service.addEvidence("profile-a", "item-1", [
        createImage("A.jpg"),
        createImage("B.jpg"),
      ]);

      await expect(
        service.reorderEvidence("profile-a", [
          evidence[0]!.fileId,
          "unknown-file-id",
        ]),
      ).rejects.toThrow();
    });

    it("rejects duplicate evidence ids during reorder", async () => {
      const evidence = await service.addEvidence("profile-a", "item-1", [
        createImage("A.jpg"),
        createImage("B.jpg"),
      ]);

      await expect(
        service.reorderEvidence("profile-a", [
          evidence[0]!.fileId,
          evidence[0]!.fileId,
        ]),
      ).rejects.toThrow();
    });

    it("rejects an incomplete evidence list during reorder", async () => {
      const evidence = await service.addEvidence("profile-a", "item-1", [
        createImage("A.jpg"),
        createImage("B.jpg"),
        createImage("C.jpg"),
      ]);

      await expect(
        service.reorderEvidence("profile-a", [
          evidence[0]!.fileId,
          evidence[1]!.fileId,
        ]),
      ).rejects.toThrow();
    });

    it("does not reorder another profile evidence", async () => {
      const evidenceA = await service.addEvidence("profile-a", "item-a", [
        createImage("A.jpg"),
      ]);

      await service.addEvidence("profile-b", "item-b", [createImage("B.jpg")]);

      await expect(
        service.reorderEvidence("profile-b", [evidenceA[0]!.fileId]),
      ).rejects.toThrow();

      const resultA = await service.listEvidence("profile-a");

      expect(resultA.map((item) => item.originalName)).toEqual(["A.jpg"]);
    });
  });

  describe("deletion", () => {
    it("deletes one evidence item", async () => {
      const evidence = await service.addEvidence("profile-a", "item-1", [
        createImage("A.jpg"),
        createImage("B.jpg"),
        createImage("C.jpg"),
      ]);

      await service.deleteEvidence("profile-a", evidence[1]!.fileId);

      const result = await service.listEvidence("profile-a");

      expect(result.map((item) => item.originalName)).toEqual([
        "A.jpg",
        "C.jpg",
      ]);
    });

    it("removes the evidence file from storage", async () => {
      const evidence = await service.addEvidence("profile-a", "item-1", [
        createImage("A.jpg"),
      ]);

      await service.deleteEvidence("profile-a", evidence[0]!.fileId);

      await expect(
        storage.read("profile-a", evidence[0]!.fileId),
      ).rejects.toThrow();
    });

    it("removes deleted evidence from metadata", async () => {
      const evidence = await service.addEvidence("profile-a", "item-1", [
        createImage("A.jpg"),
        createImage("B.jpg"),
      ]);

      await service.deleteEvidence("profile-a", evidence[0]!.fileId);

      const result = await service.listEvidence("profile-a");
      expect(result).toHaveLength(1);
      expect(result[0]!.fileId).toBe(evidence[1]!.fileId);
    });

    it("preserves remaining evidence after deletion", async () => {
      const evidence = await service.addEvidence("profile-a", "item-1", [
        createImage("A.jpg"),
        createImage("B.jpg"),
        createImage("C.jpg"),
      ]);

      await service.deleteEvidence("profile-a", evidence[1]!.fileId);

      const result = await service.listEvidence("profile-a");

      expect(result).toHaveLength(2);
      expect(result[0]!.fileId).toBe(evidence[0]!.fileId);
      expect(result[1]!.fileId).toBe(evidence[2]!.fileId);
    });

    it("rejects deleting an unknown evidence id", async () => {
      await service.addEvidence("profile-a", "item-1", [createImage("A.jpg")]);

      await expect(
        service.deleteEvidence("profile-a", "unknown-file-id"),
      ).rejects.toThrow();
    });

    it("cannot delete evidence belonging to another profile", async () => {
      const evidenceA = await service.addEvidence("profile-a", "item-a", [
        createImage("A.jpg", "image/jpeg", 1024, "profile-a"),
      ]);

      await service.addEvidence("profile-b", "item-b", [
        createImage("B.jpg", "image/jpeg", 1024, "profile-b"),
      ]);

      await expect(
        service.deleteEvidence("profile-b", evidenceA[0]!.fileId),
      ).rejects.toThrow();

      const resultA = await service.listEvidence("profile-a");

      expect(resultA).toHaveLength(1);
      expect(resultA[0]!.fileId).toBe(evidenceA[0]!.fileId);

      await expect(
        storage.read("profile-a", evidenceA[0]!.fileId),
      ).resolves.toEqual(Buffer.from("profile-a"));
    });

    it("can delete the last remaining evidence", async () => {
      const evidence = await service.addEvidence("profile-a", "item-1", [
        createImage("A.jpg"),
      ]);

      await service.deleteEvidence("profile-a", evidence[0]!.fileId);

      await expect(service.listEvidence("profile-a")).resolves.toEqual([]);
    });
  });

  describe("ordering and deletion storage failures", () => {
    it("preserves the previous order when reorder persistence fails", async () => {
      const evidence = await service.addEvidence("profile-a", "item-1", [
        createImage("A.jpg"),
        createImage("B.jpg"),
        createImage("C.jpg"),
      ]);

      const originalWrite = storage.write.bind(storage);
      const write = jest.spyOn(storage, "write");

      write.mockImplementation(async (profileId, fileId, contents) => {
        if (fileId === EVIDENCE_METADATA_FILE) {
          throw new Error("Storage failure");
        }

        return originalWrite(profileId, fileId, contents);
      });

      await expect(
        service.reorderEvidence("profile-a", [
          evidence[2]!.fileId,
          evidence[0]!.fileId,
          evidence[1]!.fileId,
        ]),
      ).rejects.toThrow("Storage failure");

      write.mockRestore();

      const result = await service.listEvidence("profile-a");

      expect(result.map((item) => item.originalName)).toEqual([
        "A.jpg",
        "B.jpg",
        "C.jpg",
      ]);
    });

    it("reports deletion storage failure clearly", async () => {
      const evidence = await service.addEvidence("profile-a", "item-1", [
        createImage("A.jpg"),
      ]);

      const deleteSpy = jest.spyOn(storage, "delete");

      deleteSpy.mockRejectedValueOnce(new Error("Storage failure"));

      await expect(
        service.deleteEvidence("profile-a", evidence[0]!.fileId),
      ).rejects.toThrow("Storage failure");
    });

    it("restores the deleted file when metadata persistence fails", async () => {
      const evidence = await service.addEvidence("profile-a", "item-1", [
        createImage("A.jpg", "image/jpeg", 1024, "original-content"),
        createImage("B.jpg", "image/jpeg", 1024, "remaining-content"),
      ]);

      const originalWrite = storage.write.bind(storage);
      const write = jest.spyOn(storage, "write");

      write.mockImplementation(async (profileId, fileId, contents) => {
        if (fileId === EVIDENCE_METADATA_FILE) {
          throw new Error("Storage failure");
        }

        return originalWrite(profileId, fileId, contents);
      });

      await expect(
        service.deleteEvidence("profile-a", evidence[0]!.fileId),
      ).rejects.toThrow("Storage failure");

      write.mockRestore();

      await expect(
        storage.read("profile-a", evidence[0]!.fileId),
      ).resolves.toEqual(Buffer.from("original-content"));

      await expect(service.listEvidence("profile-a")).resolves.toEqual(
        evidence,
      );
    });
  });
});