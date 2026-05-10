import Message from './models/Message.js';
import Conversation from './models/Conversation.js';
import User from './models/User.js';

function initChatSocket(io) {
  const chatNamespace = io.of('/chat'); // ← ADD THIS LINE

  chatNamespace.on('connection', (socket) => { // ← CHANGE io to chatNamespace

    // ─── Join conversation rooms ──────────────────────────────────────────────
    socket.on('chat-connect', ({ userId, conversationIds }) => {
      if (!userId || !conversationIds) return;

      socket.data.chatUserId = userId;

      conversationIds.forEach((id) => {
        socket.join(`chat:${id}`);
      });

      console.log(`[Chat] ${userId} joined ${conversationIds.length} conversation room(s)`);
    });

    // ─── Join a single new conversation room ─────────────────────────────────
    socket.on('chat-join-conversation', ({ conversationId }) => {
      if (!conversationId) return;
      socket.join(`chat:${conversationId}`);
      console.log(`[Chat] socket ${socket.id} joined chat:${conversationId}`);
    });

    // ─── Send a message ───────────────────────────────────────────────────────
    socket.on('chat-send-message', async ({ conversationId, senderId, content }) => {
      if (!conversationId || !senderId || !content?.trim()) return;

      try {
        const [conversation, sender] = await Promise.all([
          Conversation.findById(conversationId).populate('participants', '_id'),
          User.findById(senderId).select('blockedUsers friends'),
        ]);

        if (!conversation || !sender) return;

        if (conversation.type === 'dm') {
          const otherParticipant = conversation.participants.find(
            (p) => p._id.toString() !== senderId
          );

          if (otherParticipant) {
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

        const message = await Message.create({
          conversationId,
          sender: senderId,
          content: content.trim(),
          readBy: [senderId],
        });

        await message.populate('sender', 'userName email');

        await Conversation.findByIdAndUpdate(conversationId, {
          $pull: { deletedBy: senderId },
          lastMessage: {
            content: message.content,
            sender: senderId,
            createdAt: message.createdAt,
          },
          updatedAt: new Date(),
        });

        const updatedConversation = await Conversation.findById(conversationId)
          .populate('participants', 'userName email')
          .populate('lastMessage.sender', 'userName');

        updatedConversation.participants.forEach((participant) => {
          const participantSocketId = [...chatNamespace.sockets.values()] // ← CHANGE
            .find((s) => s.data.chatUserId === participant._id.toString())
            ?.id;

          if (participantSocketId) {
            chatNamespace.sockets.get(participantSocketId)?.join(`chat:${conversationId}`); // ← CHANGE

            chatNamespace.to(participantSocketId).emit('chat-conversation-restored', { // ← CHANGE
              conversationId,
              conversation: updatedConversation,
            });
          }
        });

        chatNamespace.to(`chat:${conversationId}`).emit('chat-receive-message', { // ← CHANGE
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
        await Message.updateMany(
          {
            conversationId,
            readBy: { $ne: userId },
          },
          {
            $addToSet: { readBy: userId },
          }
        );

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

    socket.on('disconnect', () => {
      // Socket.IO automatically removes the socket from all rooms on disconnect
    });
  });
}

export { initChatSocket };
