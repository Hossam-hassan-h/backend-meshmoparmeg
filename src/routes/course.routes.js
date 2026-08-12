
import express from 'express';
import {
  getCourses,
  getMyCourses,
  getCourseContent,
  createCourse,
  updateCourse,
  deleteCourse,
} from '../controllers/course.controller.js';
import { protect, authorize, checkEnrollment } from '../middleware/auth.js';
import { upload, memoryUpload, cloudinary } from '../config/cloudinary.js';
import { Readable } from 'stream';

const router = express.Router();

// Public routes
router.get('/', getCourses);

// Student protected routes
router.get('/my-courses', protect, getMyCourses);
router.get('/:id/content', protect, checkEnrollment, getCourseContent);

// Admin protected routes
const uploadFieldsWrapper = (req, res, next) => {
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

router.post(
  '/',
  protect,
  authorize('admin'),
  uploadFieldsWrapper,
  createCourse
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  uploadFieldsWrapper,
  updateCourse
);

router.delete('/:id', protect, authorize('admin'), deleteCourse);

export default router;

