import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    sessionToken: {
      type: String,
      default: '',
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    avatar: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', UserSchema);
