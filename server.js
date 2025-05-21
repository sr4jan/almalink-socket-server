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

// Create HTTP Server
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
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

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});