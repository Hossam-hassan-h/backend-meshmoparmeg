import express from 'express';
import { trackVisitor, getVisitorCount, getVisitorAnalytics } from '../controllers/visitor.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/track', trackVisitor);
router.get('/count', getVisitorCount);
router.get('/analytics', protect, authorize('admin'), getVisitorAnalytics);

export default router;
