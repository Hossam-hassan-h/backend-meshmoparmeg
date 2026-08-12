import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY || '123456789',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'abcdefghijklmnopqrstuvwxyz',
});

const fileFilter = (req, file, cb) => {
  const isVideo = file.mimetype.startsWith('video/');
  const isImage = file.mimetype.startsWith('image/');

  if (isImage) {
    const allowedImageMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedImageMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image format. Supported formats: jpg, jpeg, png, webp'), false);
    }
  } else if (isVideo) {
    const allowedVideoMimeTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
    if (allowedVideoMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video format. Supported formats: mp4, mov, webm, avi'), false);
    }
  } else {
    cb(new Error('Unsupported file type. Please upload an image or video file'), false);
  }
};

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max video limit
  fileFilter,
});

export const memoryUpload = upload; // Keep alias just in case

export { cloudinary };

