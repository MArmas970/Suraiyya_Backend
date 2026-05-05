import User from "../models/User.js";
import Pet from "../models/Pet.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


export const createUser = async (req, res) => {
  try {
    const user = new User({
      ...req.body,
      petID: null,   // starts without pet
      currency: 0
    });

    await user.save();
    res.status(201).json(user);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const getUsers = async (req, res) => {
  try {
    const users = await User.find().populate("petID");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("petID");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const updateUser = async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate("petID");

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    res.json(updatedUser);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser)
      return res.status(404).json({ message: "User not found" });

    res.json({ message: "User deleted successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const buyPet = async (req, res) => {
  try {
    const userID = req.params.userId;
    const { petId, cost } = req.body; // cost sent from frontend

    const user = await User.findById(userID);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.petID)
      return res.status(400).json({ error: "User already owns a pet" });

    if (user.currency < cost)
      return res.status(400).json({ error: "Not enough currency" });

    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ error: "Pet not found" });

    user.currency -= cost;
    user.petID = petId;
    await user.save();

    res.json({ message: "Pet purchased", user });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const buyAccessory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { cost } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.currency < cost)
      return res.status(400).json({ error: "Not enough currency" });

    user.currency -= cost;
    await user.save();

    res.json({ message: "Accessory purchased", user });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const updateCurrency = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.currency = user.currency + req.body.amount;
    await user.save();

    res.json({ message: "Currency updated", user });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateFCount = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.FSessionCount = user.FSessionCount + req.body.fcount;
    await user.save();

    res.json({ message: "FSessionCount updated", user });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addMoodEntry = async (req, res) => {
  try {
    const { emotion, content, date } = req.body;
    
    // Map emotions to a 1-5 score for the graph
    const moodScores = {
      joy: 5,
      happy: 5,
      excited: 5,
      surprise: 4,
      neutral: 3,
      sadness: 2,
      fear: 2,
      anger: 1,
      disgust: 1
    };

    // Default to 3 if emotion not found
    const score = moodScores[emotion.toLowerCase()] || 3;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Add to the log
    user.moodLog.push({
      date: date || new Date(),
      emotion,
      score,
      content
    });

    await user.save();
    res.json(user.moodLog);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const searchUserByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    // Use regex to find exactly this username, case-insensitively
    const user = await User.findOne(
      { userName: { $regex: new RegExp(`^${username}$`, "i") } },
      "userName email profilePic _id"
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ADD FRIEND
export const addFriend = async (req, res) => {
  try {
    const { userId, friendId } = req.params;
    if (userId === friendId) return res.status(400).json({ message: "Cannot add yourself" });

    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!user || !friend) return res.status(404).json({ message: "User not found" });

    if (user.friends.includes(friendId)) return res.status(400).json({ message: "Already friends" });
    if (user.blockedUsers && user.blockedUsers.includes(friendId)) return res.status(400).json({ message: "User is blocked" });

    user.friends.push(friendId);
    if (!friend.friends.includes(userId)) {
      friend.friends.push(userId);
      await friend.save();
    }
    await user.save();
    
    res.json({ message: "Friend added successfully", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ALL FRIENDS
export const getFriends = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).populate("friends", "userName email profilePic");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user.friends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// BLOCK FRIEND
export const blockFriend = async (req, res) => {
  try {
    const { userId, friendId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.friends = user.friends.filter((id) => id.toString() !== friendId);
    
    if (!user.blockedUsers) user.blockedUsers = [];
    if (!user.blockedUsers.includes(friendId)) user.blockedUsers.push(friendId);

    await user.save();

    const friend = await User.findById(friendId);
    if (friend) {
      friend.friends = friend.friends.filter((id) => id.toString() !== userId);
      await friend.save();
    }

    res.json({ message: "User blocked successfully", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { userId, friendId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Remove from blocked list
    user.blockedUsers = user.blockedUsers.filter(
      (id) => id.toString() !== friendId
    );

    await user.save();

    res.json({ message: 'User unblocked successfully', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('blockedUsers', 'userName profilePic');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.blockedUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const updateUsername = async (req, res) => {
  try {
    const { id } = req.params;
    const { newUsername } = req.body;

    if (!newUsername || newUsername.trim() === "") {
      return res.status(400).json({ message: "Username cannot be empty" });
    }

    // Check username length (adjust as needed)
    if (newUsername.length < 3 || newUsername.length > 20) {
      return res.status(400).json({ message: "Username must be between 3 and 20 characters" });
    }

    // Check if username already exists (excluding current user)
    const existingUser = await User.findOne({ 
      userName: { $regex: new RegExp(`^${newUsername}$`, "i") },
      _id: { $ne: id } // exclude current user
    });

    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    // Update username
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { userName: newUsername },
      { new: true, runValidators: true }
    ).select("-password"); // exclude password from response

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ 
      message: "Username updated successfully", 
      user: updatedUser 
    });

  } catch (error) {
    console.error("Error updating username:", error);
    res.status(500).json({ error: error.message });
  }
};


export const updatePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Check if all fields are provided
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All password fields are required" });
    }

    // Check if new password matches confirm password
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New password and confirm password do not match" });
    }

    // Check password strength (minimum length)
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // Find user (need password for comparison)
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });

  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ error: error.message });
  }
};

// Add these imports at the top of your userController.js
import cloudinary from '../config/cloudinary.js';
import { Readable } from 'stream';

// Add this new controller function (you can add it after your existing functions)
export const uploadProfilePicture = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const userId = req.params.id;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If user has an existing Cloudinary profile picture, delete it
    if (user.profilePic && user.profilePic.includes('cloudinary')) {
      // Extract public_id from the URL
      const urlParts = user.profilePic.split('/');
      const publicIdWithExtension = urlParts[urlParts.length - 1];
      const publicId = `profile_pictures/${publicIdWithExtension.split('.')[0]}`;
      
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (error) {
        console.log('Error deleting old image:', error);
        // Continue even if deletion fails
      }
    }

    // Convert buffer to stream for Cloudinary upload
    const uploadStream = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'profile_pictures',
            transformation: [
              { width: 500, height: 500, crop: 'fill', gravity: 'face' },
              { quality: 'auto' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        const readableStream = Readable.from(buffer);
        readableStream.pipe(stream);
      });
    };

    // Upload to Cloudinary
    const result = await uploadStream(req.file.buffer);

    // Update user's profilePic with Cloudinary URL
    user.profilePic = result.secure_url;
    await user.save();

    res.json({
      message: "Profile picture uploaded successfully",
      profilePic: user.profilePic,
      user: {
        id: user._id,
        userName: user.userName,
        email: user.email,
        profilePic: user.profilePic
      }
    });

  } catch (error) {
    console.error("Error uploading profile picture:", error);
    res.status(500).json({ error: error.message });
  }
};