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
import { Server } from 'socket.io';
import { initVideoSocket, rooms } from "./videoSocket.js";
import videoRoutes from "./routes/videoRoutes.js";
import chatRoutes from "./chatRoutes.js";
import { initChatSocket } from "./chatSocket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
connectDB();

const app = express();

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    console.log('Request origin:', origin);
    
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
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

// Socket.IO setup with production config
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'], // ← ADD
  pingTimeout: 60000, // ← ADD
  pingInterval: 25000, // ← ADD
});

// Initialize namespaces
initVideoSocket(io);
initChatSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowed CORS origins:`, allowedOrigins);
});
