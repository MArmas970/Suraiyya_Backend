const rooms = new Map(); // roomCode → Set of socket IDs

function initVideoSocket(io) {
  const videoNamespace = io.of('/video'); // ← ADD THIS LINE

  videoNamespace.on('connection', (socket) => { // ← CHANGE io to videoNamespace
    console.log(`[Video] Socket connected: ${socket.id}`);

    socket.on('join-room', ({ roomCode, userId, userName, isCreating }) => {
      if (!roomCode) return;

      // If joining (not creating), room must already exist
      if (!isCreating) {
        const room = rooms.get(roomCode);
        if (!room) {
          socket.emit('room-not-found');
          return;
        }
      }

      // Enforce max 4 participants
      const room = rooms.get(roomCode) || new Set();
      if (room.size >= 4) {
        socket.emit('room-full');
        return;
      }

      leaveRoom(socket, videoNamespace); // ← CHANGE io to videoNamespace

      room.add(socket.id);
      rooms.set(roomCode, room);
      socket.join(roomCode);

      socket.data.roomCode = roomCode;
      socket.data.userId = userId;
      socket.data.userName = userName;

      const existingPeers = [...room]
        .filter((id) => id !== socket.id)
        .map((id) => {
          const s = videoNamespace.sockets.get(id); // ← CHANGE
          return {
            socketId: id,
            userId: s?.data?.userId,
            userName: s?.data?.userName,
          };
        });

      socket.emit('room-joined', { existingPeers, roomCode });

      socket.to(roomCode).emit('peer-joined', {
        socketId: socket.id,
        userId,
        userName,
      });

      console.log(`[Video] ${userName} joined room ${roomCode} — ${room.size}/4 peers`);
    });

    socket.on('leave-room', () => leaveRoom(socket, videoNamespace)); // ← CHANGE

    socket.on('signal-offer', ({ targetSocketId, offer }) => {
      videoNamespace.to(targetSocketId).emit('signal-offer', { // ← CHANGE
        offer,
        fromSocketId: socket.id,
        fromUserId: socket.data.userId,
        fromUserName: socket.data.userName,
      });
    });

    socket.on('signal-answer', ({ targetSocketId, answer }) => {
      videoNamespace.to(targetSocketId).emit('signal-answer', { // ← CHANGE
        answer,
        fromSocketId: socket.id,
      });
    });

    socket.on('signal-ice', ({ targetSocketId, candidate }) => {
      videoNamespace.to(targetSocketId).emit('signal-ice', { // ← CHANGE
        candidate,
        fromSocketId: socket.id,
      });
    });

    socket.on('media-state', ({ audio, video }) => {
      const roomCode = socket.data.roomCode;
      if (!roomCode) return;

      socket.to(roomCode).emit('peer-media-state', {
        socketId: socket.id,
        audio,
        video,
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Video] Socket disconnected: ${socket.id}`);
      leaveRoom(socket, videoNamespace); // ← CHANGE
    });
  });
}

function leaveRoom(socket, namespace) { // ← ADD namespace parameter
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (room) {
    room.delete(socket.id);
    if (room.size === 0) {
      rooms.delete(roomCode);
      console.log(`[Video] Room ${roomCode} empty — removed`);
    } else {
      console.log(`[Video] ${socket.data.userName} left room ${roomCode} — ${room.size}/4 remaining`);
    }
  }

  socket.to(roomCode).emit('peer-left', { socketId: socket.id });
  socket.leave(roomCode);
  socket.data.roomCode = null;
  socket.data.userId = null;
  socket.data.userName = null;
}

export { initVideoSocket, rooms }; // ← CHANGE to ES6 export
