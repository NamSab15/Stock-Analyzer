// backend/services/sentimentService.js - ENHANCED
const Sentiment = require('sentiment');
const { Sentiment: SentimentModel, SentimentAggregate } = require('../models/Stock');
const { fetchNewsForStock } = require('./newsService');
const { getAllStocksList } = require('./stockService');

const sentiment = new Sentiment();

/**
 * Analyze sentiment using VADER-like algorithm
 */
function analyzeSentiment(text) {
  if (!text) return null;
  
  const result = sentiment.analyze(text);
  
  // Normalize score to -1 to 1 range
  const normalizedScore = Math.max(-1, Math.min(1, result.score / 10));
  
  // Calculate individual scores
  const totalWords = result.tokens.length || 1;
  const positiveScore = result.positive.length / totalWords;
  const negativeScore = result.negative.length / totalWords;
  const neutralScore = 1 - positiveScore - negativeScore;
  
  // Determine label
  let label = 'neutral';
  if (normalizedScore > 0.2) label = 'positive';
  else if (normalizedScore < -0.2) label = 'negative';
  
  return {
    sentimentScore: normalizedScore,
    sentimentLabel: label,
    compoundScore: result.comparative,
    positiveScore: positiveScore,
    negativeScore: negativeScore,
    neutralScore: neutralScore,
  };
}

/**
 * Process news sentiment with enhanced article fetching
 */
async function processNewsSentiment(symbol, stockName) {
  try {
    console.log(`🧠 Processing sentiment for ${symbol}...`);
    
    const articles = await fetchNewsForStock(symbol, stockName);
    
    if (articles.length === 0) {
      console.log(`⚠️  No articles found for ${symbol}`);
      return [];
    }
    
    const sentiments = [];
    
    for (const article of articles) {
      const text = `${article.title} ${article.description || ''}`;
      const sentimentData = analyzeSentiment(text);
      
      if (sentimentData) {
        // Check if this article already exists (avoid duplicates)
        const existing = await SentimentModel.findOne({
          symbol: symbol,
          headline: article.title,
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        
        if (!existing) {
          const sentimentDoc = new SentimentModel({
            symbol: symbol,
            source: 'news',
            headline: article.title,
            content: article.description,
            url: article.url,
            ...sentimentData,
          });
          
          await sentimentDoc.save();
          sentiments.push(sentimentDoc);
        }
      }
    }
    
    console.log(`✅ Processed ${sentiments.length} new articles for ${symbol}`);
    return sentiments;
  } catch (error) {
    console.error(`Error processing sentiment for ${symbol}:`, error.message);
    return [];
  }
}

/**
 * Calculate aggregate sentiment
 */
async function calculateAggregateSentiment(symbol, hours = 72) {
  try {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const sentiments = await SentimentModel.find({
      symbol: symbol,
      timestamp: { $gte: cutoffTime },
    });
    
    if (sentiments.length === 0) {
      return {
        avgSentiment: 0,
        totalMentions: 0,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        sentimentTrend: 'neutral',
        dataAvailable: false,
      };
    }
    
    const totalSentiment = sentiments.reduce((sum, s) => sum + s.sentimentScore, 0);
    const avgSentiment = totalSentiment / sentiments.length;
    
    const positiveCount = sentiments.filter(s => s.sentimentLabel === 'positive').length;
    const negativeCount = sentiments.filter(s => s.sentimentLabel === 'negative').length;
    const neutralCount = sentiments.filter(s => s.sentimentLabel === 'neutral').length;
    
    // Calculate sentiment trend
    let sentimentTrend = 'neutral';
    if (avgSentiment > 0.3) sentimentTrend = 'very bullish';
    else if (avgSentiment > 0.1) sentimentTrend = 'bullish';
    else if (avgSentiment < -0.3) sentimentTrend = 'very bearish';
    else if (avgSentiment < -0.1) sentimentTrend = 'bearish';
    
    return {
      avgSentiment: parseFloat(avgSentiment.toFixed(4)),
      totalMentions: sentiments.length,
      positiveCount,
      negativeCount,
      neutralCount,
      sentimentTrend,
      dataAvailable: true,
      positivePercentage: Math.round((positiveCount / sentiments.length) * 100),
      negativePercentage: Math.round((negativeCount / sentiments.length) * 100),
      neutralPercentage: Math.round((neutralCount / sentiments.length) * 100),
    };
  } catch (error) {
    console.error(`Error calculating aggregate sentiment for ${symbol}:`, error);
    return null;
  }
}

/**
 * Get sentiment history
 */
async function getSentimentHistory(symbol, days = 7) {
  try {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const sentiments = await SentimentModel.aggregate([
      {
        $match: {
          symbol: symbol,
          timestamp: { $gte: cutoffDate },
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            hour: { $hour: '$timestamp' },
          },
          avgSentiment: { $avg: '$sentimentScore' },
          count: { $sum: 1 },
          positive: {
            $sum: { $cond: [{ $eq: ['$sentimentLabel', 'positive'] }, 1, 0] }
          },
          negative: {
            $sum: { $cond: [{ $eq: ['$sentimentLabel', 'negative'] }, 1, 0] }
          },
        }
      },
      {
        $sort: { '_id.date': 1, '_id.hour': 1 }
      }
    ]);
    
    return sentiments.map(s => ({
      timestamp: `${s._id.date} ${s._id.hour}:00`,
      date: s._id.date,
      hour: s._id.hour,
      sentiment: parseFloat(s.avgSentiment.toFixed(4)),
      mentions: s.count,
      positive: s.positive,
      negative: s.negative,
    }));
  } catch (error) {
    console.error(`Error getting sentiment history for ${symbol}:`, error);
    return [];
  }
}

/**
 * Background job to analyze sentiment
 */
async function startSentimentAnalysis(wss) {
  console.log('🧠 Starting sentiment analysis service...');
  
  // Initial analysis for all stocks
  setTimeout(() => analyzeAllStocks(), 5000);
  
  // Run every 15 minutes
  setInterval(async () => {
    await analyzeAllStocks();
    
    // Broadcast updates via WebSocket
    if (wss) {
      const updates = await getAllStockSentiments();
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: 'sentiment_update',
            data: updates,
            timestamp: new Date(),
          }));
        }
      });
    }
  }, 15 * 60 * 1000); // 15 minutes
}

/**
 * Analyze all stocks
 */
async function analyzeAllStocks() {
  console.log('🔍 Analyzing sentiment for all stocks...');
  
  const stocks = getAllStocksList();
  let processed = 0;
  
  for (const stock of stocks) {
    try {
      await processNewsSentiment(stock.symbol, stock.name);
      processed++;
      
      // Rate limiting - 3 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Error analyzing ${stock.symbol}:`, error.message);
    }
  }
  
  console.log(`✅ Sentiment analysis complete: ${processed}/${stocks.length} stocks`);
}

/**
 * Get current sentiment for all stocks
 */
async function getAllStockSentiments() {
  const stocks = getAllStocksList();
  const results = [];
  
  for (const stock of stocks) {
    const aggregate = await calculateAggregateSentiment(stock.symbol, 72);
    if (aggregate) {
      results.push({
        symbol: stock.symbol,
        name: stock.name,
        ...aggregate,
      });
    }
  }
  
  return results;
}

/**
 * Clean old sentiment data (older than 30 days)
 */
async function cleanOldSentimentData() {
  try {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const result = await SentimentModel.deleteMany({
      timestamp: { $lt: cutoffDate }
    });
    
    console.log(`🗑️  Cleaned ${result.deletedCount} old sentiment records`);
  } catch (error) {
    console.error('Error cleaning old data:', error);
  }
}

// Schedule cleanup weekly
setInterval(cleanOldSentimentData, 7 * 24 * 60 * 60 * 1000);

module.exports = {
  analyzeSentiment,
  processNewsSentiment,
  calculateAggregateSentiment,
  getSentimentHistory,
  startSentimentAnalysis,
  analyzeAllStocks,
  getAllStockSentiments,
  cleanOldSentimentData,
};