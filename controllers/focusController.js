import FocusSession from "../models/FocusSession.js";

// GET or CREATE user's focus session
export const getUserSession = async (req, res) => {
  try {
    const { userId } = req.params;
    
    let session = await FocusSession.findOne({ userId });
    
    // If user doesn't have a session yet, create one
    if (!session) {
      session = new FocusSession({
        userId,
        totalDuration: 0,
        isActive: false,
        currentStartTime: null,
        currentEndTime: null,
      });
      await session.save();
    }
    
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// START a new focus session
export const startSession = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const session = await FocusSession.findOneAndUpdate(
      { userId },
      {
        $set: {
          isActive: true,
          currentStartTime: new Date(),
          currentEndTime: new Date(),
        },
      },
      { new: true, upsert: true } // Create if doesn't exist
    );
    
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// UPDATE session (called every minute)
// Increments totalDuration by 1 minute and updates endTime
export const updateSession = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const session = await FocusSession.findOneAndUpdate(
      { userId }, // Only update if session is active
      {
        $inc: { totalDuration: 1 }, // Increment by 1 minute
        $set: { currentEndTime: new Date() },
      },
      { new: true }
    );
    
    if (!session) {
      return res.status(404).json({ 
        message: "No active session found for this user" 
      });
    }
    
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// END session (called when timer completes or user stops)
export const endSession = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const session = await FocusSession.findOneAndUpdate(
      { userId },
      {
        $set: {
          isActive: false,
          currentEndTime: new Date(),
        },
      },
      { new: true }
    );
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET total duration for a user (for stats/leaderboard)
export const getTotalDuration = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const session = await FocusSession.findOne({ userId });
    
    if (!session) {
      return res.json({ totalDuration: 0 });
    }
    
    res.json({ totalDuration: session.totalDuration });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// OPTIONAL: Get all users' sessions (for admin/leaderboard)
export const getAllSessions = async (req, res) => {
  try {
    const sessions = await FocusSession.find().sort({ totalDuration: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// OPTIONAL: Reset a user's session (for testing or user request)
export const resetUserSession = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const session = await FocusSession.findOneAndUpdate(
      { userId },
      {
        $set: {
          totalDuration: 0,
          isActive: false,
          currentStartTime: null,
          currentEndTime: null,
        },
      },
      { new: true }
    );
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    res.json({ message: "Session reset successfully", session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
