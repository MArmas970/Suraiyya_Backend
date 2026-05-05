import express from "express";
import {
  getUserSession,
  startSession,
  updateSession,
  endSession,
  getTotalDuration,
  getAllSessions,
  resetUserSession,
} from "../controllers/focusController.js";

const router = express.Router();

// Get or create user's session
router.get("/user/:userId", getUserSession);

// Start a new focus session
router.post("/user/:userId/start", startSession);

// Update session (called every minute while active)
router.put("/user/:userId/update", updateSession);

// End the current session
router.put("/user/:userId/end", endSession);

// Get total duration for a user
router.get("/user/:userId/total", getTotalDuration);

// Get all sessions (for leaderboard/admin)
router.get("/all", getAllSessions);

// Reset user's session (optional - for testing)
router.delete("/user/:userId/reset", resetUserSession);

export default router;
