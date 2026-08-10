import multer from "multer";

// Configure multer to use memory storage
const storage = multer.memoryStorage();

// Multer configuration with file size limit of 100 MB, supporting all media types
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

export default upload;
