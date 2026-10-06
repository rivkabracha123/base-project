import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { MAX_FILES_PER_UPLOAD, MAX_FILE_SIZE_BYTES, UploadedFile } from "./evidence.types";
import { UploadsService } from "./uploads.service";

@Controller("evidence")
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post(":profileId/items/:itemId")
  @UseInterceptors(
    FilesInterceptor("files", MAX_FILES_PER_UPLOAD, {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (file.originalname.includes("..") || /[/\\]/.test(file.originalname)) {
          return callback(new BadRequestException("Unsafe filename"), false);
        }

        callback(null, true);
      },
    }),
  )
  upload(
    @Param("profileId") profileId: string,
    @Param("itemId") itemId: string,
    @UploadedFiles() files: UploadedFile[],
  ) {
    return this.uploadsService.addEvidence(profileId, itemId, files ?? []);
  }

  @Get(":profileId")
  list(
    @Param("profileId") profileId: string,
    @Query("itemId") itemId?: string,
  ) {
    return this.uploadsService.listEvidence(profileId, itemId);
  }

  @Get(":profileId/items/:itemId")
  listByItem(
    @Param("profileId") profileId: string,
    @Param("itemId") itemId: string,
  ) {
    return this.uploadsService.listEvidence(profileId, itemId);
  }

  @Patch(":profileId/order")
  async reorder(
    @Param("profileId") profileId: string,
    @Body() body: { fileIds?: unknown },
  ) {
    if (
      !Array.isArray(body?.fileIds) ||
      !body.fileIds.every((id) => typeof id === "string")
    ) {
      throw new BadRequestException("fileIds must be an array of strings");
    }

    const evidence = await this.uploadsService.reorderEvidence(
      profileId,
      body.fileIds,
    );

    return {
      success: true,
      evidence,
    };
  }

  @Get(":profileId/:fileId")
  async preview(
    @Param("profileId") profileId: string,
    @Param("fileId") fileId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, mimeType } = await this.uploadsService.readImage(
      profileId,
      fileId,
    );

    res.setHeader("Content-Type", mimeType);
    res.send(buffer);
  }

  @Get(":profileId/:fileId/download")
  async download(
    @Param("profileId") profileId: string,
    @Param("fileId") fileId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, mimeType, originalName } =
      await this.uploadsService.readImage(profileId, fileId, true);

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(originalName ?? "download")}"`,
    );
    res.send(buffer);
  }

  @Delete(":profileId/:fileId")
  async delete(
    @Param("profileId") profileId: string,
    @Param("fileId") fileId: string,
  ) {
    await this.uploadsService.deleteEvidence(profileId, fileId);

    return {
      success: true,
    };
  }
}