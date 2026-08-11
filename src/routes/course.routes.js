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
import { upload } from '../config/cloudinary.js';

const router = express.Router();

// Public routes
router.get('/', getCourses);

// Student protected routes
router.get('/my-courses', protect, getMyCourses);
router.get('/:id/content', protect, checkEnrollment, getCourseContent);

// Admin protected routes
router.post(
  '/',
  protect,
  authorize('admin'),
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  createCourse
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  updateCourse
);

router.delete('/:id', protect, authorize('admin'), deleteCourse);

export default router;
