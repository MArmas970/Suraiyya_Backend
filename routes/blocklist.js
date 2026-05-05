import express from "express";
import Blocklist from "../models/Blocklist.js";

const router = express.Router();

router.get("/:userId", async (req, res) => {
  try {
    const data = await Blocklist.findOne({ userId: req.params.userId });
    res.json(data ? data.sites : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:userId", async (req, res) => {
  try {
    let blocklist = await Blocklist.findOne({ userId: req.params.userId });
    if (!blocklist) {
      blocklist = new Blocklist({ userId: req.params.userId, sites: [] });
    }
    if (!blocklist.sites.includes(req.body.site)) {
      blocklist.sites.push(req.body.site);
      await blocklist.save();
    }
    res.json(blocklist.sites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:userId/:site", async (req, res) => {
  try {
    let blocklist = await Blocklist.findOne({ userId: req.params.userId });
    if (blocklist) {
      const decodedSite = decodeURIComponent(req.params.site);
      blocklist.sites = blocklist.sites.filter(s => s !== decodedSite);
      await blocklist.save();
    }
    res.json(blocklist ? blocklist.sites : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
