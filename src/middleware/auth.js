const socketAuth = async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.auth.userId;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }
  
      // Attach user info to socket
      socket.userId = token;
      socket.userName = socket.handshake.auth.userName || 'Anonymous';
      socket.userEmail = socket.handshake.auth.userEmail;
  
      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('Authentication failed'));
    }
  };
  
  module.exports = socketAuth;