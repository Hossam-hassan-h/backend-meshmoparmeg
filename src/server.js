import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import courseRoutes from './routes/course.routes.js';
import enrollmentRoutes from './routes/enrollment.routes.js';
import visitorRoutes from './routes/visitor.routes.js';
import categoryRoutes from './routes/category.routes.js';

import User from './models/User.js';

dotenv.config();

const app = express();

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Prevent MongoDB Operator Injection
app.use(mongoSanitize());

// Rate Limiter for Authentication Routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { message: 'Too many login/registration attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Route Mounts
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api', enrollmentRoutes);
app.use('/api/visitors', visitorRoutes);

// Healthcheck Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Global Central Error Handler
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? {} : err,
  });
});

// Auto-seed default Administrator if none exists or repair corrupted hash
const seedAdminUser = async () => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin@12345', salt);
    const admin = await User.findOne({ email: 'admin@education.com' }).select('+password');

    if (!admin) {
      await User.create({
        name: 'System Admin',
        email: 'admin@education.com',
        password: hashedPassword,
        role: 'admin',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
      });
      console.log('Default Admin Account Seeded: admin@education.com / Admin@12345');
    } else {
      const isMatch = await bcrypt.compare('Admin@12345', admin.password);
      if (!isMatch) {
        admin.password = hashedPassword;
        await admin.save();
        console.log('Default Admin Account Password Repaired: admin@education.com / Admin@12345');
      }
    }
  } catch (err) {
    console.error('Admin seeding check:', err.message);
  }
};

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/education_app';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB Database');
    seedAdminUser();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failure:', err.message);
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT} (Database disconnected state)`);
    });
  });
