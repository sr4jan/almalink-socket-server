const socketHandlers = (io) => {
    const onlineUsers = new Map();
  
    return {
      handleConnection: (socket) => {
        // Add user to online users
        onlineUsers.set(socket.userId, socket.id);
        
        // Broadcast user online status
        socket.broadcast.emit('user:online', {
          userId: socket.userId,
          userName: socket.userName
        });
  
        // Send current online users to connected user
        const onlineUsersList = Array.from(onlineUsers.keys()).filter(id => id !== socket.userId);
        socket.emit('users:online', onlineUsersList);
      },
  
      handlePrivateMessage: async (socket, data) => {
        const { receiverId, content, attachments, messageId } = data;
        
        // Get receiver's socket id
        const receiverSocketId = onlineUsers.get(receiverId);
        
        // Prepare message data
        const messageData = {
          messageId,
          content,
          attachments,
          senderId: socket.userId,
          senderName: socket.userName,
          timestamp: new Date().toISOString()
        };
  
        // Send to receiver if online
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('private:message', messageData);
        }
  
        // Acknowledge message receipt
        socket.emit('message:sent', {
          messageId,
          status: 'sent',
          timestamp: new Date().toISOString()
        });
      },
  
      handleMessageRead: (socket, data) => {
        const { messageId, senderId } = data;
        
        const senderSocketId = onlineUsers.get(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit('message:read', {
            messageId,
            readBy: socket.userId,
            timestamp: new Date().toISOString()
          });
        }
      },
  
      handleDisconnection: (socket) => {
        // Remove user from online users
        onlineUsers.delete(socket.userId);
        
        // Broadcast user offline status
        socket.broadcast.emit('user:offline', {
          userId: socket.userId,
          timestamp: new Date().toISOString()
        });
      }
    };
  };
  
  module.exports = socketHandlers;