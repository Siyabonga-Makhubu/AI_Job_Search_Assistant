import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import type { Request } from "express";

const uploadDir = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    cb(null, safeName);
  }
});

export const uploadConfig = {
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype !== "application/pdf" && !file.originalname.toLowerCase().endsWith(".pdf")) {
      const error = Object.assign(new Error("Only PDF files are allowed"), {
        statusCode: 415,
        errorCode: "INVALID_FILE_TYPE"
      });
      return cb(error);
    }
    cb(null, true);
  }
};
