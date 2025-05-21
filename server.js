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
app.use(cors());

// Add basic routes
app.get('/', (req, res) => {
  res.json({
    message: 'AlmaLink Socket Server',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      status: '/status'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/status', (req, res) => {
  res.json({
    service: 'AlmaLink Socket Server',
    status: 'operational',
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount,
    uptime: process.uptime()
  });
});

// Create HTTP Server
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
    cors: {
      origin: ['https://alma-link.vercel.app', 'http://localhost:3000'], // Add all allowed origins
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      transports: ['websocket', 'polling']
    },
    allowEIO3: true, // Allow Engine.IO version 3
    pingTimeout: 60000,
    pingInterval: 25000
  });

// Connect to MongoDB
connectDB();

// Socket.IO Authentication Middleware
io.use(socketAuth);

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  const handlers = socketHandlers(io);
  
  handlers.handleConnection(socket);

  socket.on('private:message', (data) => {
    handlers.handlePrivateMessage(socket, data);
  });

  socket.on('message:read', (data) => {
    handlers.handleMessageRead(socket, data);
  });

  socket.on('disconnect', () => {
    handlers.handleDisconnection(socket);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something broke!',
    message: err.message
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});