// backend/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const stockRoutes = require('./routes/stocks');
const sentimentRoutes = require('./routes/sentiment');
const { initializeWebSocket } = require('./utils/websocket');
const { startSentimentAnalysis } = require('./services/sentimentService');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/indian-stock-sentiment', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('✅ MongoDB Connected');
  // Do NOT auto-initialize on startup - let npm run init handle this separately
})
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.warn('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Routes
app.use('/api/stocks', stockRoutes);
app.use('/api/sentiment', sentimentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Initialize WebSocket
initializeWebSocket(wss);

// Note: Sentiment analysis is disabled on startup due to hanging requests
// It will only run on-demand via API calls
// To enable: uncomment the line below
// startSentimentAnalysis(wss);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 WebSocket server ready`);
});

// Keep server alive if it tries to close
server.on('close', () => {
  console.warn('⚠️ Server closed, restarting...');
  setTimeout(() => {
    server.listen(PORT);
  }, 1000);
});

// Prevent process from exiting on errors
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    server.close(() => {
      mongoose.disconnect();
      process.exit(0);
    });
  });
}