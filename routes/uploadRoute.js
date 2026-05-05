import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

// POST /api/upload/:userId
router.post("/:userId", upload.single("profilePic"), async (req, res) => {
  try {
    const userId = req.params.userId;

    // File path (use absolute or relative as per your need)
    const filePath = `/uploads/${req.file.filename}`;

    // Update user in MongoDB
    const user = await User.findOneAndUpdate(
      { userId },
      { profilePic: filePath },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Profile picture uploaded successfully",
      filePath,
      user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
