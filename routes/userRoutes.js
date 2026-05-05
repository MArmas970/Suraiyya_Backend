import express from "express";
import {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  buyPet,
  buyAccessory,
  updateCurrency,
  updateFCount,
  addMoodEntry,
  searchUserByUsername,
  addFriend,
  getFriends,
  blockFriend,
  unblockUser,
  getBlockedUsers,
  updateUsername,
  updatePassword,
  uploadProfilePicture  // Add this import
} from "../controllers/userController.js";

import upload from "../middleware/upload.js";  // Add this import

const router = express.Router();

// Specific routes first
router.put("/:id/username", updateUsername);
router.put("/:id/password", updatePassword);

// Profile picture upload route - Add this line
router.post("/:id/profile-picture", upload.single('profilePicture'), uploadProfilePicture);

router.post("/:userId/friends/:friendId", addFriend);
router.get("/:userId/friends", getFriends);
router.post("/:userId/block/:friendId", blockFriend);
router.put('/:userId/unblock/:friendId', unblockUser);
router.get('/:userId/blocked', getBlockedUsers);
router.post("/:userId/buy-pet", buyPet);
router.post("/:userId/buy-accessory", buyAccessory);
router.put("/:userId/FSessionCount", updateFCount);
router.put("/:userId/currency", updateCurrency);
router.post("/:id/mood", addMoodEntry);
router.get("/search/:username", searchUserByUsername);

// Generic routes last
router.post("/", createUser);
router.get("/", getUsers);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;