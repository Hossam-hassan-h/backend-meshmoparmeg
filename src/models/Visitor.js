import mongoose from 'mongoose';

const VisitorSchema = new mongoose.Schema(
  {
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      default: 'Unknown Browser',
    },
    country: {
      type: String,
      default: 'International',
    },
    visitedAt: {
      type: Date,
      default: Date.now,
    },
    lastVisit: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Visitor', VisitorSchema);
