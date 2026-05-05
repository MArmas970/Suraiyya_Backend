import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import focusRoutes from "./routes/focusRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import petRoutes from "./routes/petRoutes.js";
import shopRoutes from "./routes/shopRoutes.js"
import ideaRoutes from "./routes/ideaRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import path from "path";
import { fileURLToPath } from "url";
import blocklistRoutes from "./routes/blocklist.js";
import http from 'http';
import {Server} from 'socket.io';
import { initVideoSocket, rooms } from "./videoSocket.js";
import videoRoutes from "./routes/videoRoutes.js";
import chatRoutes from "./chatRoutes.js";
import { initChatSocket } from "./chatSocket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/users", userRoutes);
app.use("/api/focus", focusRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/blocklist", blocklistRoutes);
app.use("/api/pets", petRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api/ideas", ideaRoutes);
app.use("/api/tasks", taskRoutes);
app.use('/api/video', videoRoutes(rooms));
app.use('/api/chat', chatRoutes);

app.get("/", (req, res) => {
  res.send("Backend server is running");
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
initVideoSocket(io);
initChatSocket(io);
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
});
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

