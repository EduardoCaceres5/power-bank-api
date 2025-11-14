import multer from 'multer';
import { Request } from 'express';

// Configure multer to use memory storage (files will be in req.file.buffer)
const storage = multer.memoryStorage();

// File filter to accept only images and videos
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Allowed image types
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  // Allowed video types
  const videoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm', 'video/x-msvideo'];

  const allowedTypes = [...imageTypes, ...videoTypes];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 1, // Max 1 file per request
  },
});

// Middleware to handle multer errors
export const handleMulterError = (err: any, req: Request, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 50MB.',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Only 1 file is allowed.',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected field name. Use "file" as the field name.',
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message || 'File upload failed',
    });
  }

  next();
};
