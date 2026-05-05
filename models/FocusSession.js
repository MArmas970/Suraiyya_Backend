import mongoose from "mongoose";

const focusSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true, // One session document per user
      index: true,
    },
    totalDuration: {
      type: Number,
      default: 0,
      required: true,
      // Total focus time in MINUTES
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    currentStartTime: {
      type: Date,
      default: null,
    },
    currentEndTime: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

const FocusSession = mongoose.model("FocusSession", focusSessionSchema);

export default FocusSession;
