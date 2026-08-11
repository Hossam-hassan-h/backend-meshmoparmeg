import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY || '123456789',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'abcdefghijklmnopqrstuvwxyz',
});

// Configure Multer Cloudinary storage engine
let storage;

try {
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      const isVideo = file.mimetype.startsWith('video');
      return {
        folder: 'education_app_media',
        resource_type: isVideo ? 'video' : 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mkv', 'webm', 'mov'],
      };
    },
  });
} catch (err) {
  console.warn('Cloudinary storage engine fallback to disk storage:', err.message);
  storage = multer.diskStorage({});
}

export const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max video limit
});

export { cloudinary };
