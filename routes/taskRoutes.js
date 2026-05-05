import express from "express";
const router = express.Router();
import Task from "../models/Task.js";

router.post("/", async (req, res) => {
  try {
    const { userId, text } = req.body;

    if (!userId || !text) {
      return res.status(400).json({ error: "userId and text are required" });
    }

    const task = await Task.create({ userId, text });

    res.json({ message: "Task saved!", task });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const tasks = await Task.find({ userId }).sort({ createdAt: -1 });

    res.json({ tasks });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.delete("/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;

    await Task.findByIdAndDelete(taskId);

    res.json({ message: "Task deleted" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { text } = req.body;

    if (!text) return res.status(400).json({ error: "Text is required" });

    const updated = await Task.findByIdAndUpdate(
      taskId,
      { text },
      { new: true }
    );

    res.json({ message: "Task updated", task: updated });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
