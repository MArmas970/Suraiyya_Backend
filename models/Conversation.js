const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['dm', 'group'],
      required: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    // Group chat only fields
    name: {
      type: String,
      trim: true,
      maxLength: 50,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Latest message — stored here for fast conversation list rendering
    lastMessage: {
      content: String,
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      createdAt: Date,
    },
    deletedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Ensure no duplicate DMs between the same two users
conversationSchema.index(
  { type: 1, participants: 1 },
  { unique: false } // we enforce uniqueness manually in the route
);

module.exports = mongoose.model('Conversation', conversationSchema);