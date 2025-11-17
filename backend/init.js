const mongoose = require('mongoose');
const { updateAllStocks } = require('./services/stockService');
require('dotenv').config();

async function init() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/indian-stock-sentiment');
    console.log('✅ Connected');
    
    console.log('📈 Fetching stock data...');
    await updateAllStocks();
    
    console.log('✅ Done! Check http://localhost:5000/api/stocks');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

init();