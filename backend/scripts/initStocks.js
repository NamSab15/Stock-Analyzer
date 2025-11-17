// backend/scripts/initStocks.js
const mongoose = require('mongoose');
const { Stock } = require('../models/Stock');
const { initializeStocks } = require('../services/stockService');
require('dotenv').config();

/**
 * Initialize the database with stock data
 * Run this script once after setting up the database
 */
async function init() {
  try {
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/indian-stock-sentiment', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Clear existing data (optional - comment out if you want to keep existing data)
    // await Stock.deleteMany({});
    // console.log(' Cleared existing stock data');
    
    // Initialize stocks
    await initializeStocks();
    
    console.log('Stock initialization complete!');
    console.log('You can now start the server with: npm start');
    
    process.exit(0);
  } catch (error) {
    console.error('Error initializing stocks:', error);
    process.exit(1);
  }
}

init();