import { Request } from "express";
import multer, { FileFilterCallback } from "multer";

// Configure multer to use memory storage
const storage = multer.memoryStorage();

// File filter to allow only images, videos, and PDFs
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  const mimeType = file.mimetype.split("/")[0];

  if (
    ["image", "video"].includes(mimeType) ||
    file.mimetype === "application/pdf"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// Multer configuration with file size limit of 10 MB
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

export default upload;
