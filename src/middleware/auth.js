import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';

// Protect routes - Verify JWT Token & Enforce Single Session & Block Check
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user account not found' });
      }

      // Check if user account is blocked
      if (user.isBlocked) {
        return res.status(403).json({ message: 'Your account has been suspended by an administrator.' });
      }

      // SINGLE-SESSION SECURITY: Verify JWT sessionToken matches latest database sessionToken
      if (decoded.sessionToken !== user.sessionToken) {
        return res.status(401).json({
          message: 'Single Session Security: You have logged in on another device. Please log in again.',
          sessionExpired: true,
        });
      }

      // Update last active heartbeat timestamp (non-blocking)
      User.findByIdAndUpdate(user._id, { lastActive: new Date() }).exec();

      req.user = user;
      return next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token invalid or expired' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

// Authorize roles - Check req.user.role
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role '${req.user?.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

// Check Enrollment Security Rule: PUBLIC courses accessible to all active users, PRIVATE requires Enrollment document
export const checkEnrollment = async (req, res, next) => {
  try {
    const courseId = req.params.id || req.params.courseId;

    if (!courseId) {
      return res.status(400).json({ message: 'Course ID is required for access verification' });
    }

    // Admins bypass enrollment checks
    if (req.user.role === 'admin') {
      return next();
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // If course is PUBLIC, any authenticated, active student can watch
    if (course.accessType === 'PUBLIC') {
      return next();
    }

    // If PRIVATE, verify Enrollment record exists
    const enrollment = await Enrollment.findOne({
      userId: req.user._id,
      courseId: courseId,
    });

    if (!enrollment) {
      return res.status(403).json({
        message: 'Access Denied: This is a PRIVATE course. Access must be granted by an Admin.',
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Error verifying course access privileges', error: error.message });
  }
};
