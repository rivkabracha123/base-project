import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFileStorage } from '../storage/local-file-storage.service';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  let root: string;
  let storage: LocalFileStorage;
  let service: UploadsService;

  const createImage = (
    originalname: string,
    mimetype = 'image/jpeg',
    size = 1024,
    content = 'synthetic-image',
  ) => ({
    originalname,
    mimetype,
    size,
    buffer: Buffer.from(content),
  });

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'monabid-uploads-'));

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

  describe('uploading images', () => {
    it('starts with an empty gallery for a profile with no evidence', async () => {
      const result = await service.listEvidence('profile-a');

      expect(result).toEqual([]);
    });

    it('stores a single uploaded image and returns it in the gallery', async () => {
      const result = await service.addEvidence('profile-a', [
        createImage('front.jpg'),
      ]);

      expect(result).toHaveLength(1);
    });

    it('returns the mime type together with the image bytes', async () => {
      const [item] = await service.addEvidence('profile-a', [
        createImage('front.jpg', 'image/jpeg'),
      ]);

      const result = await service.readImage('profile-a', item!.fileId);

      expect(result.mimeType).toBe('image/jpeg');
    });

    it('stores multiple images from a single upload call', async () => {
      const result = await service.addEvidence('profile-a', [
        createImage('front.jpg'),
        createImage('back.png', 'image/png'),
        createImage('side.webp', 'image/webp'),
      ]);

      expect(result).toHaveLength(3);
    });

    it('preserves the original filename and mime type as metadata', async () => {
      const result = await service.addEvidence('profile-a', [
        createImage('front.jpg', 'image/jpeg'),
      ]);

      expect(result[0]).toMatchObject({
        originalName: 'front.jpg',
        mimeType: 'image/jpeg',
      });
    });

    it('returns a preview reference that can be used to fetch the image', async () => {
      const [item] = await service.addEvidence('profile-a', [
        createImage(
          'front.jpg',
          'image/jpeg',
          1024,
          'synthetic-image-content',
        ),
      ]);

      const { buffer } = await service.readImage(
        'profile-a',
        item!.fileId,
      );

      expect(buffer.toString()).toBe('synthetic-image-content');
    });
  });

  describe('file safety', () => {
    it.each([
      ['image/jpeg', 'photo.jpg'],
      ['image/png', 'photo.png'],
      ['image/webp', 'photo.webp'],
    ])('accepts allowed image type %s', async (mimeType, fileName) => {
      const result = await service.addEvidence('profile-a', [
        createImage(fileName, mimeType),
      ]);

      expect(result).toHaveLength(1);
    });
    it('rejects uploads with more files than the maximum allowed', async () => {
      const files = Array.from({ length: 11 }, (_, i) => createImage(`photo-${i}.jpg`));

      await expect(service.addEvidence('profile-a', files)).rejects.toThrow('Too many files');
    });
    it('does not save any files if one of them fails validation', async () => {
      const write = jest.spyOn(storage, 'write');

      await expect(
        service.addEvidence('profile-a', [
          createImage('good.jpg'),
          createImage('bad.pdf', 'application/pdf'),
        ]),
      ).rejects.toThrow('Unsupported file type');

      expect(write).not.toHaveBeenCalled();
    });

    it('rejects unsupported file types', async () => {
      await expect(
        service.addEvidence('profile-a', [
          createImage('document.pdf', 'application/pdf'),
        ]),
      ).rejects.toThrow();
    });

    it('rejects files larger than the maximum allowed size', async () => {
      const tooLarge = 10 * 1024 * 1024 + 1;

      await expect(
        service.addEvidence('profile-a', [
          createImage('huge.jpg', 'image/jpeg', tooLarge),
        ]),
      ).rejects.toThrow();
    });

    it('rejects unsafe filenames', async () => {
      await expect(
        service.addEvidence('profile-a', [
          createImage('../../outside.jpg'),
        ]),
      ).rejects.toThrow();
    });
  });

    it('accepts filenames with spaces and non-English characters', async () => {
    const result = await service.addEvidence('profile-a', [
      createImage('תמונה 1.jpg'),
    ]);

    expect(result).toHaveLength(1);
  });

  describe('profile isolation', () => {
    it('keeps same-named files separate between profiles', async () => {
      const [itemA] = await service.addEvidence('profile-a', [
        createImage('photo.jpg', 'image/jpeg', 1024, 'profile-a'),
      ]);

      const [itemB] = await service.addEvidence('profile-b', [
        createImage('photo.jpg', 'image/jpeg', 1024, 'profile-b'),
      ]);

      const resultA = await service.readImage(
        'profile-a',
        itemA!.fileId,
      );

      const resultB = await service.readImage(
        'profile-b',
        itemB!.fileId,
      );

      expect(resultA.buffer.toString()).toBe('profile-a');
      expect(resultB.buffer.toString()).toBe('profile-b');
    });

    it('prevents one profile from reading another profile file', async () => {
      const [item] = await service.addEvidence('profile-a', [
        createImage('private.jpg', 'image/jpeg', 1024, 'private'),
      ]);

      await expect(
        service.readImage('profile-b', item!.fileId),
      ).rejects.toThrow();
    });
  });

  describe('storage failures', () => {
    it('does not leave partial metadata when storage fails', async () => {
      const write = jest.spyOn(storage, 'write');

      write.mockRejectedValueOnce(new Error('Storage failure'));

      await expect(
        service.addEvidence('profile-a', [
          createImage('front.jpg'),
          createImage('back.jpg'),
        ]),
      ).rejects.toThrow('Storage failure');

      await expect(
        service.listEvidence('profile-a'),
      ).resolves.toEqual([]);
    });

    it('propagates unexpected errors instead of treating them as empty', async () => {
      const read = jest.spyOn(storage, 'read');
      read.mockRejectedValueOnce(new Error('Disk corrupted'));

      await expect(service.listEvidence('profile-a')).rejects.toThrow('Disk corrupted');
    });
  });

  describe('evidence contract', () => {
    it('returns evidence references with the required metadata', async () => {
      const [item] = await service.addEvidence('profile-a', [
        createImage('front.jpg', 'image/jpeg', 2048),
      ]);

      expect(item).toEqual({
        fileId: expect.any(String),
        originalName: 'front.jpg',
        mimeType: 'image/jpeg',
        size: 2048,
      });
    });
  });
});
