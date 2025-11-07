import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import config from './config.js';
import db from '../database/connection.js';
import WebSocketService from '../services/WebSocketService.js';
import callRoutes from './routes/calls.js';
import agentRoutes from './routes/agents.js';
import contactRoutes from './routes/contacts.js';

const app = express();
const server = createServer(app);

// Middleware
app.use(helmet());
app.use(cors({ origin: config.security.corsOrigin }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindow,
  max: config.security.rateLimitMax,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Static file serving
app.use(express.static('public'));
app.use('/audio', express.static('public/audio'));

// API Routes
app.use('/api/agents', agentRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/contacts', contactRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Web management interface
app.get('/', (req, res) => {
  res.sendFile('public/index.html', { root: process.cwd() });
});

// Initialize WebSocket service
const wsService = new WebSocketService(server);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await db.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await db.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
async function startServer() {
  try {
    // Initialize database connection
    await db.connect();
    console.log('Database connected successfully');

    server.listen(config.app.port, () => {
      console.log(`🚀 Voice AI Agent System v2.0.0 running on port ${config.app.port}`);
      console.log(`📊 Web Interface: http://localhost:${config.app.port}`);
      console.log(`🔗 Twilio Webhooks: ${config.app.baseUrl}/api/calls/twiml/:agentId`);
      console.log(`🌐 WebSocket: ws://localhost:${config.websocket.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();