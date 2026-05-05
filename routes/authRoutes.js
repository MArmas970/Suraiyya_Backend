import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "keywhatkey";

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUseremail = await User.findOne({ email });
    const existingUsername = await User.findOne({ userName: name });
    if (existingUseremail) {
      return res.status(400).json({ message: "Email already registered" });
    }
    if (existingUsername) {
      return res.status(400).json({ message: "Username already registered" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate a unique userId (you could use uuid or a custom logic)
    const userId = "U" + Date.now();

    // Create new user
    const newUser = new User({
      userId,
      userName: name,
      email,
      password: hashedPassword,
      profilePic: "/home.jpg", // default profile image
      FSessionCount: 0,
      petID: null,
      currency: 0,
      friends: [],
    });

    await newUser.save();

    res.status(201).json({
      message: "User registered successfully",
      user: {
        userId: newUser.userId,
        userName: newUser.userName,
        email: newUser.email,
        profilePic: newUser.profilePic,
      },
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// --- Login User ---
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ userName: username });

    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "3d" });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.userName,
        email: user.email,
        profilePic: user.profilePic,
        petID: user.petID,
        currency: user.currency,
        FSessionCount: user.FSessionCount,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;
