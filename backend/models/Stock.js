// backend/models/Stock.js
const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  exchange: { type: String, enum: ['NSE', 'BSE'], default: 'NSE' },
  currentPrice: Number,
  previousClose: Number,
  change: Number,
  changePercent: Number,
  volume: Number,
  marketCap: Number,
  lastUpdated: { type: Date, default: Date.now },
});

const sentimentSchema = new mongoose.Schema({
  symbol: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  source: { type: String, enum: ['news', 'twitter', 'reddit'], required: true },
  headline: String,
  content: String,
  sentimentScore: { type: Number, min: -1, max: 1 },
  sentimentLabel: { type: String, enum: ['positive', 'negative', 'neutral'] },
  url: String,
});

sentimentSchema.index({ symbol: 1, timestamp: -1 });

const sentimentAggregateSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  date: { type: Date, required: true },
  hour: { type: Number, min: 0, max: 23 },
  avgSentiment: Number,
  count: Number,
  timestamp: { type: Date, default: Date.now },
});

const Stock = mongoose.model('Stock', stockSchema);
const Sentiment = mongoose.model('Sentiment', sentimentSchema);
const SentimentAggregate = mongoose.model('SentimentAggregate', sentimentAggregateSchema);

module.exports = { Stock, Sentiment, SentimentAggregate };
