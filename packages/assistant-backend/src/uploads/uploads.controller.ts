import { Controller, Get, Param, Post, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { MAX_FILES_PER_UPLOAD, MAX_FILE_SIZE_BYTES, UploadedFile } from './evidence.types';
import { UploadsService } from './uploads.service';

@Controller('evidence')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post(':profileId')
  @UseInterceptors(
    // Multer defaults to memory storage when no destination or storage engine
    // is configured, so UploadsService remains in full control of persistence.
    FilesInterceptor('files', MAX_FILES_PER_UPLOAD, {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  upload(@Param('profileId') profileId: string, @UploadedFiles() files: UploadedFile[]) {
    return this.uploadsService.addEvidence(profileId, files ?? []);
  }

  @Get(':profileId')
  list(@Param('profileId') profileId: string) {
    return this.uploadsService.listEvidence(profileId);
  }

  @Get(':profileId/:fileId')
  async preview(
    @Param('profileId') profileId: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, mimeType } = await this.uploadsService.readImage(profileId, fileId);
    res.setHeader('Content-Type', mimeType);
    res.send(buffer);
  }
}
