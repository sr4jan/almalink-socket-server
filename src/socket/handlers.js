const Message = require('../models/Message');

// Store online users
const onlineUsers = new Map();

const socketHandlers = (io) => {
  return {
    handleConnection: (socket) => {
      const userId = socket.userId;
      onlineUsers.set(userId, socket.id);
      
      // Broadcast user's online status
      io.emit('user:online', userId);
      
      // Join user's room for private messages
      socket.join(userId);
      
      console.log(`User connected: ${userId}`);
    },

    handleDisconnection: (socket) => {
      const userId = socket.userId;
      onlineUsers.delete(userId);
      io.emit('user:offline', userId);
      console.log(`User disconnected: ${userId}`);
    },

    handlePrivateMessage: async (socket, data) => {
      try {
        const { receiverId, content, attachments } = data;
        
        // Create and save message
        const message = await Message.create({
          sender: socket.userId,
          receiver: receiverId,
          content,
          attachments
        });

        // Populate message with sender/receiver details
        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'username profile.avatar')
          .populate('receiver', 'username profile.avatar');

        // Send to receiver if online
        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('private:message', populatedMessage);
        }

        // Send confirmation to sender
        socket.emit('message:sent', populatedMessage);
      } catch (error) {
        socket.emit('message:error', { error: error.message });
      }
    },

    handleMessageRead: async (socket, data) => {
      try {
        const { messageId } = data;
        await Message.findByIdAndUpdate(messageId, { read: true });
        socket.emit('message:read:success', { messageId });
      } catch (error) {
        socket.emit('message:read:error', { error: error.message });
      }
    }
  };
};

module.exports = socketHandlers;