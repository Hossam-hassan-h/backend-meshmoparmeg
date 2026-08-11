import express from 'express';
import {
  grantAccess,
  revokeAccess,
  getAllUsersWithEnrollments,
  toggleBlockUser,
  deleteUser,
  getAdminStats,
  createUser,
  updateUser,
} from '../controllers/enrollment.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/enrollments', protect, authorize('admin'), grantAccess);
router.delete('/enrollments/:id', protect, authorize('admin'), revokeAccess);

router.get('/admin/stats', protect, authorize('admin'), getAdminStats);
router.get('/admin/users', protect, authorize('admin'), getAllUsersWithEnrollments);
router.post('/admin/users', protect, authorize('admin'), createUser);
router.put('/admin/users/:id', protect, authorize('admin'), updateUser);
router.patch('/admin/users/:id/block', protect, authorize('admin'), toggleBlockUser);
router.delete('/admin/users/:id', protect, authorize('admin'), deleteUser);

export default router;
