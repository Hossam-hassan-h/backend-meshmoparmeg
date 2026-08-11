import mongoose from 'mongoose';

const EnrollmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
  },
  { timestamps: true }
);

// Ensure a user cannot be enrolled in the same course twice
EnrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export default mongoose.model('Enrollment', EnrollmentSchema);
