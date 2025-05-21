require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./src/config/db');
const socketAuth = require('./src/middleware/auth');
const socketHandlers = require('./src/socket/handlers');

// Initialize Express
const app = express();

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'https://alma-link.vercel.app'
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Utility function for formatted UTC date
const getFormattedUTCDate = () => {
  return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
};

// Basic routes
app.get('/', (req, res) => {
  res.json({
    message: 'AlmaLink Socket Server',
    status: 'running',
    timestamp: getFormattedUTCDate(),
    version: '1.0.0',
    endpoints: {
      health: '/health',
      status: '/status'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: getFormattedUTCDate(),
    uptime: process.uptime()
  });
});

let io; // Declare io in wider scope

app.get('/status', (req, res) => {
  res.json({
    service: 'AlmaLink Socket Server',
    status: 'operational',
    timestamp: getFormattedUTCDate(),
    connections: io?.engine?.clientsCount || 0,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV
  });
});

// Create HTTP Server
const httpServer = createServer(app);

// Initialize Socket.IO
io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    transports: ['websocket', 'polling']
  },
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e8 // 100 MB
});

// Connect to MongoDB
connectDB();

// Socket.IO Authentication Middleware
io.use(socketAuth);

// Active connections store
const activeConnections = new Map();

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  const handlers = socketHandlers(io);
  
  // Store connection with timestamp
  activeConnections.set(socket.id, {
    userId: socket.userId,
    userName: socket.userName,
    connectedAt: getFormattedUTCDate(),
    userEmail: socket.userEmail
  });
  
  // Log connection
  console.log('Socket connected:', {
    socketId: socket.id,
    userId: socket.userId,
    userName: socket.userName,
    timestamp: getFormattedUTCDate()
  });

  // Initialize connection
  handlers.handleConnection(socket);

  // Handle private messages
  socket.on('private:message', async (data) => {
    try {
      await handlers.handlePrivateMessage(socket, data);
    } catch (error) {
      console.error('Message handling error:', {
        error: error.message,
        socketId: socket.id,
        userId: socket.userId,
        timestamp: getFormattedUTCDate()
      });

      socket.emit('message:error', {
        error: 'Failed to process message',
        messageId: data?.messageId,
        timestamp: getFormattedUTCDate()
      });
    }
  });

  // Handle message read receipts
  socket.on('message:read', (data) => {
    try {
      handlers.handleMessageRead(socket, data);
    } catch (error) {
      console.error('Read receipt error:', {
        error: error.message,
        socketId: socket.id,
        userId: socket.userId,
        timestamp: getFormattedUTCDate()
      });
    }
  });

  // Handle typing indicators
  socket.on('typing:start', ({ receiverId }) => {
    socket.to(receiverId).emit('typing:start', {
      userId: socket.userId,
      timestamp: getFormattedUTCDate()
    });
  });

  socket.on('typing:stop', ({ receiverId }) => {
    socket.to(receiverId).emit('typing:stop', {
      userId: socket.userId,
      timestamp: getFormattedUTCDate()
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    try {
      handlers.handleDisconnection(socket);
      activeConnections.delete(socket.id);
      
      console.log('Socket disconnected:', {
        socketId: socket.id,
        userId: socket.userId,
        timestamp: getFormattedUTCDate()
      });
    } catch (error) {
      console.error('Disconnect handler error:', {
        error: error.message,
        socketId: socket.id,
        timestamp: getFormattedUTCDate()
      });
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', {
    error: err.message,
    stack: err.stack,
    timestamp: getFormattedUTCDate()
  });
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: getFormattedUTCDate()
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    timestamp: getFormattedUTCDate()
  });
});

// Start server
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server Info:`, {
    message: `Socket server running on port ${PORT}`,
    environment: process.env.NODE_ENV,
    timestamp: getFormattedUTCDate()
  });
});

// Handle process errors
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', {
    error: err.message,
    stack: err.stack,
    timestamp: getFormattedUTCDate()
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', {
    error: err.message,
    stack: err.stack,
    timestamp: getFormattedUTCDate()
  });
  
  // Give the server a grace period to finish existing requests
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Performing graceful shutdown...', {
    timestamp: getFormattedUTCDate()
  });
  
  httpServer.close(() => {
    console.log('Server closed', {
      timestamp: getFormattedUTCDate()
    });
    process.exit(0);
  });
});