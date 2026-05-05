import Message from './models/Message.js';
import Conversation from './models/Conversation.js';
import User from './models/User.js';

function initChatSocket(io) {
  io.on('connection', (socket) => {

    // ─── Join conversation rooms ──────────────────────────────────────────────
    // Called when a user opens the chat page — joins all their conversation
    // rooms so they receive messages in real time
    socket.on('chat-connect', ({ userId, conversationIds }) => {
      if (!userId || !conversationIds) return;

      socket.data.chatUserId = userId;

      conversationIds.forEach((id) => {
        socket.join(`chat:${id}`);
      });

      console.log(`[Chat] ${userId} joined ${conversationIds.length} conversation room(s)`);
    });

    // ─── Join a single new conversation room ─────────────────────────────────
    // Called when a user creates or opens a new conversation
    socket.on('chat-join-conversation', ({ conversationId }) => {
      if (!conversationId) return;
      socket.join(`chat:${conversationId}`);
      console.log(`[Chat] socket ${socket.id} joined chat:${conversationId}`);
    });

    // ─── Send a message ───────────────────────────────────────────────────────
    socket.on('chat-send-message', async ({ conversationId, senderId, content }) => {
      if (!conversationId || !senderId || !content?.trim()) return;

      try {
        // Fetch the conversation and sender's blocked list
        const [conversation, sender] = await Promise.all([
          Conversation.findById(conversationId).populate('participants', '_id'),
          User.findById(senderId).select('blockedUsers friends'),
        ]);

        if (!conversation || !sender) return;

        // For DMs — check if either user has blocked the other
        if (conversation.type === 'dm') {
          const otherParticipant = conversation.participants.find(
            (p) => p._id.toString() !== senderId
          );

          if (otherParticipant) {
            // Check if sender has blocked the other user
            const isBlocked = sender.blockedUsers
              ?.map((id) => id.toString())
              .includes(otherParticipant._id.toString());

            if (isBlocked) {
              socket.emit('chat-blocked', {
                conversationId,
                message: 'You have blocked this user.',
              });
              return;
            }

            // Check if the other user has blocked the sender
            const otherUser = await User.findById(otherParticipant._id)
              .select('blockedUsers friends');
            
            const isBlockedByOther = otherUser?.blockedUsers
              ?.map((id) => id.toString())
              .includes(senderId);

            if (isBlockedByOther) {
              socket.emit('chat-blocked', {
                conversationId,
                message: 'You cannot send messages to this user.',
              });
              return;
            }

            // Check if they are still friends
            const isFriend = sender.friends
              ?.map((id) => id.toString())
              .includes(otherParticipant._id.toString());

            if (!isFriend) {
              socket.emit('chat-blocked', {
                conversationId,
                message: 'You can only message friends.',
              });
              return;
            }
          }
        }

        // Save and broadcast message as normal
        const message = await Message.create({
          conversationId,
          sender: senderId,
          content: content.trim(),
          readBy: [senderId],
        });

        await message.populate('sender', 'userName email');

        await Conversation.findByIdAndUpdate(conversationId, {
          // Remove sender from deletedBy so conversation reappears for them
          $pull: { deletedBy: senderId },
          lastMessage: {
            content: message.content,
            sender: senderId,
            createdAt: message.createdAt,
          },
          updatedAt: new Date(),
        });

        // Notify all participants in case any of them had deleted the conversation
        const updatedConversation = await Conversation.findById(conversationId)
          .populate('participants', 'userName email')
          .populate('lastMessage.sender', 'userName');

        updatedConversation.participants.forEach((participant) => {
          // Find the socket for this participant
          const participantSocketId = [...io.sockets.sockets.values()]
            .find((s) => s.data.chatUserId === participant._id.toString())
            ?.id;

          if (participantSocketId) {
            // Re-join the conversation room in case they left
            io.sockets.sockets.get(participantSocketId)?.join(`chat:${conversationId}`);

            // Notify them to re-fetch their conversations
            io.to(participantSocketId).emit('chat-conversation-restored', {
              conversationId,
              conversation: updatedConversation,
            });
          }
        });

        io.to(`chat:${conversationId}`).emit('chat-receive-message', {
          message,
          conversationId,
        });

        console.log(`[Chat] message in ${conversationId} from ${senderId}`);
      } catch (err) {
        console.error('[Chat] send message error:', err);
        socket.emit('chat-error', { error: 'Failed to send message' });
      }
    });

    // ─── Mark messages as read ────────────────────────────────────────────────
    socket.on('chat-mark-read', async ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;

      try {
        // Mark all unread messages in this conversation as read by this user
        await Message.updateMany(
          {
            conversationId,
            readBy: { $ne: userId },
          },
          {
            $addToSet: { readBy: userId },
          }
        );

        // Notify others in the room that this user has read the messages
        socket.to(`chat:${conversationId}`).emit('chat-messages-read', {
          conversationId,
          userId,
        });
      } catch (err) {
        console.error('[Chat] mark read error:', err);
      }
    });

    // ─── Typing indicators ────────────────────────────────────────────────────
    socket.on('chat-typing', ({ conversationId, userId, userName }) => {
      if (!conversationId) return;
      socket.to(`chat:${conversationId}`).emit('chat-user-typing', {
        conversationId,
        userId,
        userName,
      });
    });

    socket.on('chat-stop-typing', ({ conversationId, userId }) => {
      if (!conversationId) return;
      socket.to(`chat:${conversationId}`).emit('chat-user-stop-typing', {
        conversationId,
        userId,
      });
    });

    // ─── Cleanup on disconnect ────────────────────────────────────────────────
    socket.on('disconnect', () => {
      // Socket.IO automatically removes the socket from all rooms on disconnect
      // Nothing extra needed here — video disconnect is handled in videoSocket.js
    });
  });
}

export { initChatSocket };