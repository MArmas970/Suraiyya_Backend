import mongoose from "mongoose";

const blocklistSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  sites: [String]
});

const Blocklist = mongoose.model("Blocklist", blocklistSchema);
export default Blocklist;