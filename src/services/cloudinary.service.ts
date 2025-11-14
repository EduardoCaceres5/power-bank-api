import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface UploadOptions {
  folder?: string;
  resourceType?: 'image' | 'video' | 'auto';
  transformation?: object[];
  format?: string;
}

interface UploadResult {
  publicId: string;
  secureUrl: string;
  format: string;
  resourceType: 'image' | 'video';
  width?: number;
  height?: number;
  duration?: number;
  bytes: number;
}

class CloudinaryService {
  /**
   * Check if Cloudinary is properly configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }

  /**
   * Upload a file buffer to Cloudinary
   */
  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new Error('Cloudinary is not configured. Please set environment variables.');
    }

    // Create a readable stream from buffer
    const stream = Readable.from(buffer);

    const defaultOptions = {
      folder: options.folder || process.env.CLOUDINARY_FOLDER || 'power-bank-materials',
      resource_type: options.resourceType || 'auto',
      public_id: filename.split('.')[0], // Use filename without extension
      unique_filename: true,
      overwrite: false,
    };

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          ...defaultOptions,
          transformation: options.transformation,
          format: options.format,
        },
        (error, result) => {
          if (error) {
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
            return;
          }

          if (!result) {
            reject(new Error('Cloudinary upload failed: No result returned'));
            return;
          }

          resolve({
            publicId: result.public_id,
            secureUrl: result.secure_url,
            format: result.format,
            resourceType: result.resource_type as 'image' | 'video',
            width: result.width,
            height: result.height,
            duration: result.duration,
            bytes: result.bytes,
          });
        }
      );

      stream.pipe(uploadStream);
    });
  }

  /**
   * Upload a file from a local path to Cloudinary
   */
  async uploadFile(
    filePath: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new Error('Cloudinary is not configured. Please set environment variables.');
    }

    const defaultOptions = {
      folder: options.folder || process.env.CLOUDINARY_FOLDER || 'power-bank-materials',
      resource_type: options.resourceType || 'auto',
      unique_filename: true,
      overwrite: false,
    };

    try {
      const result = await cloudinary.uploader.upload(filePath, {
        ...defaultOptions,
        transformation: options.transformation,
        format: options.format,
      });

      return {
        publicId: result.public_id,
        secureUrl: result.secure_url,
        format: result.format,
        resourceType: result.resource_type as 'image' | 'video',
        width: result.width,
        height: result.height,
        duration: result.duration,
        bytes: result.bytes,
      };
    } catch (error) {
      throw new Error(
        `Cloudinary upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a file from Cloudinary
   */
  async deleteFile(publicId: string, resourceType: 'image' | 'video' = 'image'): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Cloudinary is not configured. Please set environment variables.');
    }

    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true, // Invalidate CDN cache
      });
    } catch (error) {
      throw new Error(
        `Cloudinary delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get file details from Cloudinary
   */
  async getFileDetails(publicId: string, resourceType: 'image' | 'video' = 'image') {
    if (!this.isConfigured()) {
      throw new Error('Cloudinary is not configured. Please set environment variables.');
    }

    try {
      const result = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      });

      return {
        publicId: result.public_id,
        secureUrl: result.secure_url,
        format: result.format,
        resourceType: result.resource_type,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        createdAt: result.created_at,
      };
    } catch (error) {
      throw new Error(
        `Failed to get file details: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate a transformation URL for an existing image
   */
  generateTransformationUrl(
    publicId: string,
    transformations: {
      width?: number;
      height?: number;
      crop?: string;
      quality?: string | number;
      format?: string;
    }
  ): string {
    return cloudinary.url(publicId, {
      transformation: [transformations],
      secure: true,
    });
  }
}

export const cloudinaryService = new CloudinaryService();
