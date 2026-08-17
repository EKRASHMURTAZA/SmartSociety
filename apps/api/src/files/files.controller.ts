import { BadRequestException, Controller, Param, Post, Req, UseGuards, UseInterceptors, UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { AuthGuard, AuthenticatedRequest } from "../auth/auth.guard";

function safeExtension(original: string) {
  const ext = extname(original).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : "";
}

@Controller("files")
@UseGuards(AuthGuard)
export class FilesController {
  @Post(":kind")
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: 5 * 1024 * 1024 },
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, process.env.UPLOAD_DIR ?? "./uploads"),
      filename: (_req, file, cb) => {
        const ext = safeExtension(file.originalname);
        if (!ext) return cb(new Error("Only JPG, PNG and WEBP files are allowed"), "");
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype));
    },
  }))
  upload(@Req() req: AuthenticatedRequest, @Param("kind") kind: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("Image file is required");
    if (!["profiles", "visitors", "complaints"].includes(kind)) throw new BadRequestException("Unsupported upload type");
    return { url: `/uploads/${file.filename}`, kind, userId: req.user.id };
  }
}
