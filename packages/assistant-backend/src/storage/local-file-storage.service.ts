import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

@Injectable()
export class LocalFileStorage {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.getOrThrow<string>('LOCAL_STORAGE_PATH'));
  }

  async write(profileId: string, fileId: string, contents: Buffer): Promise<void> {
    const path = this.filePath(profileId, fileId);
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, contents);
  }

  read(profileId: string, fileId: string): Promise<Buffer> {
    return readFile(this.filePath(profileId, fileId));
  }

  deleteProfile(profileId: string): Promise<void> {
    return rm(this.profilePath(profileId), { recursive: true, force: true });
  }

  private profilePath(profileId: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(profileId)) throw new Error('Invalid profile identifier');
    const path = resolve(this.root, profileId);
    if (!path.startsWith(`${this.root}${sep}`)) throw new Error('Storage path escaped its root');
    return path;
  }

  private filePath(profileId: string, fileId: string): string {
    if (!/^[a-zA-Z0-9_.-]+$/.test(fileId)) throw new Error('Invalid file identifier');
    return resolve(this.profilePath(profileId), fileId);
  }
}
