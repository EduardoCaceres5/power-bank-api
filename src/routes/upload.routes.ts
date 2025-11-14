import { Router, Request, Response, NextFunction } from 'express';
import { upload, handleMulterError } from '../middleware/upload.middleware';
import { cloudinaryService } from '../services/cloudinary.service';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/v1/upload/material
 * Upload a material file (image or video) to Cloudinary
 * Requires authentication
 */
router.post(
  '/material',
  authenticateToken,
  upload.single('file'),
  handleMulterError,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded. Please provide a file in the "file" field.',
        });
      }

      // Check if Cloudinary is configured
      if (!cloudinaryService.isConfigured()) {
        return res.status(500).json({
          success: false,
          error: 'Upload service is not configured. Please contact the administrator.',
        });
      }

      // Determine resource type based on mimetype
      const isImage = req.file.mimetype.startsWith('image/');
      const isVideo = req.file.mimetype.startsWith('video/');
      const resourceType = isImage ? 'image' : isVideo ? 'video' : 'auto';

      // Upload to Cloudinary
      const result = await cloudinaryService.uploadBuffer(
        req.file.buffer,
        req.file.originalname,
        {
          resourceType: resourceType as 'image' | 'video' | 'auto',
          folder: process.env.CLOUDINARY_FOLDER || 'power-bank-materials',
        }
      );

      // Return the Cloudinary URL and metadata
      return res.status(200).json({
        success: true,
        data: {
          url: result.secureUrl,
          publicId: result.publicId,
          format: result.format,
          resourceType: result.resourceType,
          width: result.width,
          height: result.height,
          duration: result.duration,
          bytes: result.bytes,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
        },
      });
    } catch (error) {
      console.error('Upload error:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/upload/material/:publicId
 * Delete a material file from Cloudinary
 * Requires authentication
 */
router.delete(
  '/material/:publicId',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { publicId } = req.params;
      const { resourceType } = req.query;

      if (!publicId) {
        return res.status(400).json({
          success: false,
          error: 'Public ID is required',
        });
      }

      // Decode public ID (it might be URL encoded)
      const decodedPublicId = decodeURIComponent(publicId);

      await cloudinaryService.deleteFile(
        decodedPublicId,
        (resourceType as 'image' | 'video') || 'image'
      );

      return res.status(200).json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error) {
      console.error('Delete error:', error);
      next(error);
    }
  }
);

export default router;
