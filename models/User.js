import mongoose from "mongoose";
import { type } from "os";

const userSchema = new mongoose.Schema({
  userName: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  profilePic: {
    type: String,
    default: "/home.jpg",
  },

  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  FSessionCount: { type: Number, default: 0 },

  // New fields
  petID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Pet",
    default: null, // user may not own a pet yet
  },
  ownedPets: [{ type: String }],
  currency: {
    type: Number,
    default: 0,
  },
  moodLog: [
    {
      date: { type: Date, default: Date.now },
      emotion: { type: String }, // e.g., "joy", "anger"
      score: { type: Number },   // 1 to 5 scale for the graph
      content: { type: String }  // The journal entry text
    }
  ]
});

export default mongoose.model("User", userSchema);
