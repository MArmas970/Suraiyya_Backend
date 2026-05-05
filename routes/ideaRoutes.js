import express from "express";
const router = express.Router();
import Idea from "../models/Idea.js";


router.post("/", async (req, res) => {
  try {
    const { userId, text } = req.body;

    if (!userId || !text) {
      return res.status(400).json({ error: "userId and text are required" });
    }

    const idea = await Idea.create({ userId, text });

    res.json({ message: "Idea saved!", idea });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const ideas = await Idea.find({ userId }).sort({ createdAt: -1 });

    res.json({ ideas });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.delete("/:ideaId", async (req, res) => {
  try {
    const { ideaId } = req.params;

    await Idea.findByIdAndDelete(ideaId);

    res.json({ message: "Idea deleted" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.put("/:ideaId", async (req, res) => {
  try {
    const { ideaId } = req.params;
    const { text } = req.body;

    if (!text) return res.status(400).json({ error: "Text is required" });

    const updated = await Idea.findByIdAndUpdate(
      ideaId,
      { text },
      { new: true }
    );

    res.json({ message: "Idea updated", idea: updated });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
