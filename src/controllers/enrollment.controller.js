import Enrollment from '../models/Enrollment.js';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Category from '../models/Category.js';
import Visitor from '../models/Visitor.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// @desc    Grant course access to single or multiple users (Admin only)
// @route   POST /api/enrollments
// @access  Private (Admin)
export const grantAccess = async (req, res) => {
  try {
    const { userId, userIds, courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: 'courseId is required' });
    }

    const targetUserIds = Array.isArray(userIds) ? userIds : userId ? [userId] : [];

    if (targetUserIds.length === 0) {
      return res.status(400).json({ message: 'Please select at least one user' });
    }

    const createdEnrollments = [];
    for (const uid of targetUserIds) {
      const existing = await Enrollment.findOne({ userId: uid, courseId });
      if (!existing) {
        const enrollment = await Enrollment.create({ userId: uid, courseId });
        createdEnrollments.push(enrollment);
      }
    }

    res.status(201).json({
      message: `Successfully granted course access to ${createdEnrollments.length} user(s)`,
      enrollments: createdEnrollments,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error granting course access', error: error.message });
  }
};

// @desc    Revoke course access (Admin only)
// @route   DELETE /api/enrollments/:id
// @access  Private (Admin)
export const revokeAccess = async (req, res) => {
  try {
    const enrollment = await Enrollment.findByIdAndDelete(req.params.id);
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment record not found' });
    }
    res.json({ message: 'Access revoked successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error revoking course access', error: error.message });
  }
};

// @desc    Get all users with enrollments, search, filter, and online status (Admin only)
// @route   GET /api/admin/users
// @access  Private (Admin)
export const getAllUsersWithEnrollments = async (req, res) => {
  try {
    const { search, role, status } = req.query;

    const query = {};
    if (role && role !== 'all') query.role = role;
    if (status === 'blocked') query.isBlocked = true;
    if (status === 'active') query.isBlocked = false;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query).select('-password').sort({ createdAt: -1 }).lean();
    const enrollments = await Enrollment.find().populate('courseId', 'title');

    // Online status threshold: active within the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const usersWithAccess = users.map((user) => {
      const userEnrollments = enrollments.filter(
        (e) => e.userId.toString() === user._id.toString()
      );

      const isOnline = user.lastActive ? new Date(user.lastActive) > fiveMinutesAgo : false;

      return {
        ...user,
        isOnline,
        enrollments: userEnrollments,
      };
    });

    res.json(usersWithAccess);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users list', error: error.message });
  }
};

// @desc    Toggle block/unblock user status (Admin)
// @route   PATCH /api/admin/users/:id/block
// @access  Private (Admin)
export const toggleBlockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Administrator accounts cannot be blocked' });
    }

    user.isBlocked = !user.isBlocked;
    // Clear session token if blocked
    if (user.isBlocked) {
      user.sessionToken = '';
    }

    await user.save();

    res.json({
      message: `User account ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`,
      isBlocked: user.isBlocked,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error toggling user block status', error: error.message });
  }
};

// @desc    Create a new user (Admin only)
// @route   POST /api/admin/users
// @access  Private (Admin)
export const createUser = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role } = req.body;

    if (!name || !email || !password || !confirmPassword || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ message: 'An account already exists with this email' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const sessionToken = crypto.randomBytes(32).toString('hex');

    const newUser = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role,
      sessionToken,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        avatar: newUser.avatar,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
};

// @desc    Update a user (Admin only)
// @route   PUT /api/admin/users/:id
// @access  Private (Admin)
export const updateUser = async (req, res) => {
  try {
    const { name, email, role, password, isBlocked } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent blocking or changing role of the currently logged-in Admin
    if (userId === req.user._id.toString()) {
      if (role && role !== 'admin') {
        return res.status(400).json({ message: 'You cannot change your own Admin role' });
      }
      if (isBlocked === true) {
        return res.status(400).json({ message: 'You cannot block your own account' });
      }
    }

    if (name) user.name = name;
    
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail !== user.email) {
        const emailExists = await User.findOne({ email: normalizedEmail });
        if (emailExists) {
          return res.status(400).json({ message: 'Email is already in use by another account' });
        }
        user.email = normalizedEmail;
      }
    }

    if (role) {
      user.role = role;
    }

    if (typeof isBlocked === 'boolean') {
      user.isBlocked = isBlocked;
      // If blocked, invalidate session token
      if (isBlocked) {
        user.sessionToken = '';
      }
    }

    if (password && password.trim() !== '') {
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
      // Invalidate existing sessions on password change
      user.sessionToken = '';
    }

    await user.save();

    res.json({
      message: 'User updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isBlocked: user.isBlocked,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
};

// @desc    Delete user account (Admin)
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own Administrator account' });
    }

    await User.findByIdAndDelete(req.params.id);
    await Enrollment.deleteMany({ userId: req.params.id });

    res.json({ message: 'User account and enrollment records deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user account', error: error.message });
  }
};

// @desc    Get detailed platform admin analytics
// @route   GET /api/admin/stats
// @access  Private (Admin)
export const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const totalCourses = await Course.countDocuments();
    const totalCategories = await Category.countDocuments();

    // Visitor analytics metrics
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalVisitors = await Visitor.countDocuments();
    const todayVisitors = await Visitor.countDocuments({ visitedAt: { $gte: startOfToday } });
    const weeklyVisitors = await Visitor.countDocuments({ visitedAt: { $gte: startOfWeek } });
    const monthlyVisitors = await Visitor.countDocuments({ visitedAt: { $gte: startOfMonth } });

    const recentUsers = await User.find().select('-password').sort({ createdAt: -1 }).limit(5);
    const recentCourses = await Course.find().populate('category', 'name').sort({ createdAt: -1 }).limit(5);

    res.json({
      totalUsers,
      totalStudents,
      totalAdmins,
      totalCourses,
      totalCategories,
      totalVisitors,
      todayVisitors,
      weeklyVisitors,
      monthlyVisitors,
      recentUsers,
      recentCourses,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin analytics', error: error.message });
  }
};
