import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFiles, UseInterceptors} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { MAX_FILES_PER_UPLOAD, MAX_FILE_SIZE_BYTES, UploadedFile } from "./evidence.types";
import { UploadsService } from "./uploads.service";

@Controller("evidence")
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post(":profileId")
  @UseInterceptors(
    // Multer defaults to memory storage when no destination or storage engine
    // is configured, so UploadsService remains in full control of persistence.
    FilesInterceptor("files", MAX_FILES_PER_UPLOAD, {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  upload(
    @Param("profileId") profileId: string,
    @UploadedFiles() files: UploadedFile[],
  ) {
    return this.uploadsService.addEvidence(profileId, files ?? []);
  }

  @Get(":profileId")
  list(@Param("profileId") profileId: string) {
    return this.uploadsService.listEvidence(profileId);
  }

  @Patch(":profileId/order")
  async reorder(
    @Param("profileId") profileId: string,
    @Body() body: { fileIds?: unknown }, // Validate the complete reorder request before changing the persisted evidence order.
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
}
