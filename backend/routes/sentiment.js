// backend/routes/sentiment.js
const express = require('express');
const router = express.Router();
const { Sentiment } = require('../models/Stock');
const {
  processNewsSentiment,
  getAllStockSentiments,
  calculateAggregateSentiment,
  getSentimentHistory,
} = require('../services/sentimentService');
const { fetchNewsForStock } = require('../services/newsService');

/**
 * GET /api/sentiment/:symbol - Get aggregate sentiment for a stock
 */
router.get('/:symbol', async (req, res) => {
  try {
    let { symbol } = req.params;
    const { hours = 24 } = req.query;
    
    if (!symbol.includes('.')) {
      symbol += '.NS';
    }
    
    const sentiment = await calculateAggregateSentiment(symbol, parseInt(hours));
    
    res.json({
      success: true,
      symbol,
      hours: parseInt(hours),
      data: sentiment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/sentiment/:symbol/history - Get sentiment history
 */
router.get('/:symbol/history', async (req, res) => {
  try {
    let { symbol } = req.params;
    const { days = 7 } = req.query;
    
    if (!symbol.includes('.')) {
      symbol += '.NS';
    }
    
    const history = await getSentimentHistory(symbol, parseInt(days));
    
    res.json({
      success: true,
      symbol,
      days: parseInt(days),
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
 * GET /api/sentiment/:symbol/news - Get news articles with sentiment
 */
router.get('/:symbol/news', async (req, res) => {
  try {
    let { symbol } = req.params;
    const { limit = 20 } = req.query;
    
    if (!symbol.includes('.')) {
      symbol += '.NS';
    }
    
    const news = await Sentiment.find({ symbol })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      symbol,
      count: news.length,
      data: news,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sentiment/:symbol/analyze - Trigger sentiment analysis
 */
router.post('/:symbol/analyze', async (req, res) => {
  try {
    let { symbol } = req.params;
    
    if (!symbol.includes('.')) {
      symbol += '.NS';
    }
    
    const sentiments = await processNewsSentiment(symbol);
    const aggregate = await calculateAggregateSentiment(symbol, 24);
    
    res.json({
      success: true,
      symbol,
      analyzed: sentiments.length,
      aggregate,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/sentiment/all - Get sentiment for all tracked stocks
 */
router.get('/', async (req, res) => {
  try {
    const sentiments = await getAllStockSentiments();
    
    res.json({
      success: true,
      count: sentiments.length,
      data: sentiments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
