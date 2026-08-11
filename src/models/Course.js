import mongoose from 'mongoose';

const CourseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, 'Course description is required'],
    },
    teachingMethodology: {
      type: String,
      required: [true, 'Teaching methodology is required'],
    },
    difficulty: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
      default: 'Beginner',
    },
    duration: {
      type: String,
      default: '4 Hours',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
    requirements: {
      type: [String],
      default: [],
    },
    learningOutcomes: {
      type: [String],
      default: [],
    },
    accessType: {
      type: String,
      enum: ['PUBLIC', 'PRIVATE'],
      default: 'PRIVATE',
    },
    thumbnail: {
      url: { type: String, required: true },
      public_id: { type: String, default: '' },
    },
    video: {
      url: { type: String, required: true },
      public_id: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Course', CourseSchema);
