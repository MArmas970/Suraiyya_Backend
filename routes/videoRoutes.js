const express = require('express');
const router = express.Router();

// We need access to the rooms Map from videoSocket.js
// So we'll export it from there and import it here

module.exports = (rooms) => {
  // GET /api/video/room/:code — check if a room exists and how many peers are in it
  router.get('/room/:code', (req, res) => {
    const roomCode = req.params.code.toUpperCase();
    const room = rooms.get(roomCode);

    if (!room) {
      return res.json({
        exists: false,
        roomCode,
        peerCount: 0,
        full: false,
      });
    }

    return res.json({
      exists: true,
      roomCode,
      peerCount: room.size,
      full: room.size >= 4,
    });
  });

  // GET /api/video/rooms — dev only, see all active rooms
  router.get('/rooms', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not available in production' });
    }

    const allRooms = [];
    rooms.forEach((peers, code) => {
      allRooms.push({ roomCode: code, peerCount: peers.size });
    });

    return res.json({ activeRooms: allRooms });
  });

  return router;
};