// backend/routes/stocks.js
const express = require('express');
const router = express.Router();
const { Stock } = require('../models/Stock');
const { 
  fetchStockData, 
  getHistoricalData, 
  searchStocks,
  getIntradayData,
  getAllStocksList,
  updateAllStocks
} = require('../services/stockService');
const { generatePrediction } = require('../services/predictionService');

/**
 * GET /api/stocks/config/list - Get canonical stock list (for UI dropdown)
 */
router.get('/config/list', async (req, res) => {
  try {
    const stocks = getAllStocksList().map(stock => ({
      symbol: stock.symbol,
      name: stock.name,
      exchange: stock.exchange,
      sector: stock.sector,
    }));
    
    res.json({
      success: true,
      count: stocks.length,
      data: stocks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stocks - Get all tracked stocks
 */
router.get('/', async (req, res) => {
  try {
    const stocks = await Stock.find()
      .sort({ symbol: 1 })
      .select('-__v');
    
    res.json({
      success: true,
      count: stocks.length,
      data: stocks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stocks/search - Search stocks with autocomplete (DB first, then Yahoo fallback)
 */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 1) {
      const allStocks = getAllStocksList();
      return res.json({
        success: true,
        query: '',
        count: allStocks.length,
        data: allStocks.slice(0, 5), // show only 4-5 by default
      });
    }
    
    // Try database/static search first
    let results = await searchStocks(q);

    // If no db/static results, fallback to Yahoo search
    if (!results || results.length === 0) {
      const { searchYahoo } = require('../services/stockService');
      const yahooResults = await searchYahoo(q);
      // normalize symbol names (append .NS for NSE listings if missing)
      results = yahooResults.map(r => ({
        symbol: r.symbol.includes('.') ? r.symbol : (r.symbol + (r.exchange === 'NSE' ? '.NS' : '')),
        name: r.name,
        exchange: r.exchange,
      }));
    }
    
    res.json({
      success: true,
      query: q,
      count: results.length,
      data: results.slice(0, 20),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stocks/:symbol/prediction - Get AI prediction
 */
router.get('/:symbol/prediction', async (req, res) => {
  try {
    let { symbol } = req.params;
    
    if (!symbol.includes('.')) {
      symbol += '.NS';
    }
    
    const prediction = await generatePrediction(symbol);
    
    if (!prediction.success) {
      return res.status(400).json(prediction);
    }
    
    res.json(prediction);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stocks/:symbol/history - Get historical data
 */
router.get('/:symbol/history', async (req, res) => {
  try {
    let { symbol } = req.params;
    const { days = 30 } = req.query;
    
    if (!symbol.includes('.')) {
      symbol += '.NS';
    }
    
    const history = await getHistoricalData(symbol, parseInt(days));
    
    res.json({
      success: true,
      symbol,
      days: parseInt(days),
      count: history.length,
      data: history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stocks/:symbol/intraday - Get intraday data
 */
router.get('/:symbol/intraday', async (req, res) => {
  try {
    let { symbol } = req.params;
    
    if (!symbol.includes('.')) {
      symbol += '.NS';
    }
    
    const intraday = await getIntradayData(symbol);
    
    res.json({
      success: true,
      symbol,
      count: intraday.length,
      data: intraday,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stocks/:symbol - Get specific stock data
 */
router.get('/:symbol', async (req, res) => {
  try {
    let { symbol } = req.params;
    
    // Add .NS suffix if not present
    if (!symbol.includes('.')) {
      symbol += '.NS';
    }
    
    const stock = await Stock.findOne({ symbol });
    
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: 'Stock not found',
      });
    }
    
    res.json({
      success: true,
      data: stock,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/stocks/refresh/:symbol - Manually refresh stock data
 */
router.post('/refresh/:symbol', async (req, res) => {
  try {
    let { symbol } = req.params;
    
    if (!symbol.includes('.')) {
      symbol += '.NS';
    }
    
    const stockData = await fetchStockData(symbol);
    
    if (!stockData) {
      return res.status(404).json({
        success: false,
        error: 'Unable to fetch stock data',
      });
    }
    
    const stock = await Stock.findOneAndUpdate(
      { symbol },
      stockData,
      { new: true, upsert: true }
    );
    
    res.json({
      success: true,
      data: stock,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/stocks/refresh-all - Refresh all stocks
 */
router.post('/refresh-all', async (req, res) => {
  try {
    const result = await updateAllStocks();
    
    res.json({
      success: true,
      message: 'Stock update initiated',
      result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stocks/:symbol/news - Get news articles for a stock (with featured market news fallback)
 */
router.get('/:symbol/news', async (req, res) => {
  try {
    let { symbol } = req.params;
    const { limit = 10 } = req.query;
    
    if (!symbol.includes('.')) {
      symbol += '.NS';
    }
    
    const { fetchNewsForStock, fetchLatestMarketNews } = require('../services/newsService');
    
    // Fetch news for the specific stock
    const stockNews = await fetchNewsForStock(symbol);
    
    let articles = [];
    if (stockNews && stockNews.length > 0) {
      articles = stockNews.slice(0, parseInt(limit));
    } else {
      // If no specific news found, fetch general market news as fallback
      const marketNews = await fetchLatestMarketNews();
      articles = marketNews.slice(0, parseInt(limit));
    }
    
    res.json({
      success: true,
      symbol,
      count: articles.length,
      hasStockSpecificNews: stockNews && stockNews.length > 0,
      data: articles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;