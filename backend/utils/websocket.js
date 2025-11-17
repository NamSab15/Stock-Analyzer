// backend/utils/websocket.js
const { Stock } = require('../models/Stock');
const { calculateAggregateSentiment } = require('../services/sentimentService');

/**
 * Initialize WebSocket server and handle connections
 */
function initializeWebSocket(wss) {
  console.log('🔌 WebSocket server initialized');
  
  wss.on('connection', (ws) => {
    console.log('✅ New client connected');
    
    // Send initial data on connection
    sendInitialData(ws);
    
    // Handle messages from client
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        await handleClientMessage(ws, data);
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    });
    
    // Handle client disconnect
    ws.on('close', () => {
      console.log('❌ Client disconnected');
    });
    
    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  // Broadcast stock updates every 30 seconds
  setInterval(() => {
    broadcastStockUpdates(wss);
  }, 30000);
}

/**
 * Send initial data when client connects
 */
async function sendInitialData(ws) {
  try {
    const stocks = await Stock.find().limit(15);
    
    ws.send(JSON.stringify({
      type: 'initial_data',
      data: stocks,
      timestamp: new Date(),
    }));
  } catch (error) {
    console.error('Error sending initial data:', error);
  }
}

/**
 * Handle different message types from client
 */
async function handleClientMessage(ws, data) {
  const { type, payload } = data;
  
  switch (type) {
    case 'subscribe':
      // Subscribe to specific stock updates
      await handleSubscribe(ws, payload);
      break;
      
    case 'unsubscribe':
      // Unsubscribe from stock updates
      handleUnsubscribe(ws, payload);
      break;
      
    case 'request_update':
      // Request immediate update for a stock
      await handleUpdateRequest(ws, payload);
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Unknown message type',
      }));
  }
}

/**
 * Handle stock subscription
 */
async function handleSubscribe(ws, payload) {
  const { symbol } = payload;
  
  if (!ws.subscriptions) {
    ws.subscriptions = new Set();
  }
  
  ws.subscriptions.add(symbol);
  
  // Send immediate update for subscribed stock
  try {
    const stock = await Stock.findOne({ symbol });
    const sentiment = await calculateAggregateSentiment(symbol, 24);
    
    ws.send(JSON.stringify({
      type: 'subscription_update',
      symbol,
      data: {
        stock,
        sentiment,
      },
      timestamp: new Date(),
    }));
  } catch (error) {
    console.error(`Error handling subscription for ${symbol}:`, error);
  }
}

/**
 * Handle unsubscribe
 */
function handleUnsubscribe(ws, payload) {
  const { symbol } = payload;
  
  if (ws.subscriptions) {
    ws.subscriptions.delete(symbol);
  }
  
  ws.send(JSON.stringify({
    type: 'unsubscribed',
    symbol,
    timestamp: new Date(),
  }));
}

/**
 * Handle update request
 */
async function handleUpdateRequest(ws, payload) {
  const { symbol } = payload;
  
  try {
    const stock = await Stock.findOne({ symbol });
    const sentiment = await calculateAggregateSentiment(symbol, 24);
    
    ws.send(JSON.stringify({
      type: 'update_response',
      symbol,
      data: {
        stock,
        sentiment,
      },
      timestamp: new Date(),
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      message: `Error fetching data for ${symbol}`,
    }));
  }
}

/**
 * Broadcast stock updates to all connected clients
 */
async function broadcastStockUpdates(wss) {
  try {
    const stocks = await Stock.find().limit(15);
    
    const updates = await Promise.all(
      stocks.map(async (stock) => ({
        stock,
        sentiment: await calculateAggregateSentiment(stock.symbol, 24),
      }))
    );
    
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        // Send only subscribed stocks if client has subscriptions
        if (client.subscriptions && client.subscriptions.size > 0) {
          const subscribedUpdates = updates.filter(u => 
            client.subscriptions.has(u.stock.symbol)
          );
          
          if (subscribedUpdates.length > 0) {
            client.send(JSON.stringify({
              type: 'stock_update',
              data: subscribedUpdates,
              timestamp: new Date(),
            }));
          }
        } else {
          // Send all updates if no specific subscriptions
          client.send(JSON.stringify({
            type: 'stock_update',
            data: updates,
            timestamp: new Date(),
          }));
        }
      }
    });
  } catch (error) {
    console.error('Error broadcasting updates:', error);
  }
}

/**
 * Broadcast sentiment alerts (large sentiment changes)
 */
async function broadcastSentimentAlert(wss, symbol, alert) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'sentiment_alert',
        symbol,
        alert,
        timestamp: new Date(),
      }));
    }
  });
}

module.exports = {
  initializeWebSocket,
  broadcastStockUpdates,
  broadcastSentimentAlert,
};