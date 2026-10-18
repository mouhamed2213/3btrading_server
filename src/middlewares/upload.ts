import multer from "multer";
import { badRequest } from "../lib/errors.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.has(file.mimetype)
      ? cb(null, true)
      : cb(badRequest("Format non supporté (JPEG, PNG ou WebP uniquement)")),
});
