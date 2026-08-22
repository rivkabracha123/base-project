import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { LocalFileStorage } from './local-file-storage.service';

describe('LocalFileStorage', () => {
  let root: string;
  let storage: LocalFileStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'monabid-storage-'));
    storage = new LocalFileStorage(new ConfigService({ LOCAL_STORAGE_PATH: root }));
  });

  afterEach(() => rm(root, { recursive: true, force: true }));

  it('isolates files by anonymous profile', async () => {
    await storage.write('profile-a', 'photo.jpg', Buffer.from('a'));
    await storage.write('profile-b', 'photo.jpg', Buffer.from('b'));

    await expect(storage.read('profile-a', 'photo.jpg')).resolves.toEqual(Buffer.from('a'));
    await expect(storage.read('profile-b', 'photo.jpg')).resolves.toEqual(Buffer.from('b'));
  });

  it('rejects path traversal', () => {
    expect(() => storage.read('../profile-b', 'photo.jpg')).toThrow('Invalid profile identifier');
  });
});
