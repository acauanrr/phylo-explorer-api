import multer from "multer";

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB default
const ALLOWED_MIME_TYPES = ["text/csv", "application/csv", "application/vnd.ms-excel"];

export const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    const error = new Error("No file uploaded");
    error.status = 400;
    return next(error);
  }

  // Check file type
  if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
    const error = new Error("Invalid file type. Only CSV files are allowed");
    error.status = 400;
    return next(error);
  }

  // Check file size
  if (req.file.size > MAX_FILE_SIZE) {
    const error = new Error(`File size exceeds limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    error.status = 400;
    return next(error);
  }

  next();
};

export const multerConfig = multer({
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only CSV files are allowed"), false);
    }
  },
});