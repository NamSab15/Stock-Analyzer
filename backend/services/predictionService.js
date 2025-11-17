// backend/services/predictionService.js - AI Trading Prediction Service
const { Stock, Sentiment } = require('../models/Stock');
const { calculateAggregateSentiment, getSentimentHistory } = require('./sentimentService');
const { getHistoricalData, fetchStockData } = require('./stockService');

/**
 * Generate AI prediction with trading signal
 */
async function generatePrediction(symbol) {
  try {
    // Fetch required data
    let stock = await Stock.findOne({ symbol });
    // If stock not found in DB, try to fetch realtime data
    if (!stock) {
      try {
        const live = await fetchStockData(symbol);
        if (live) {
          stock = {
            symbol: live.symbol || symbol,
            name: live.shortName || live.symbol || symbol,
            exchange: live.exchange || 'NSE',
            currentPrice: live.currentPrice || live.regularMarketPrice || 0,
            previousClose: live.previousClose || live.regularMarketPreviousClose || 0,
            change: (live.currentPrice || live.regularMarketPrice || 0) - (live.previousClose || live.regularMarketPreviousClose || 0),
            changePercent: live.changePercent || live.regularMarketChangePercent || 0,
            volume: live.volume || live.regularMarketVolume || 0,
            dayHigh: live.dayHigh || live.regularMarketDayHigh || 0,
            dayLow: live.dayLow || live.regularMarketDayLow || 0,
            lastUpdated: new Date(),
          };
        }
      } catch (err) {
        console.warn('Live fetch failed for', symbol, err.message);
      }
    }

    const sentiment = await calculateAggregateSentiment(symbol, 72);
    const history = await getHistoricalData(symbol, 30);

    if (!stock || !sentiment || history.length === 0) {
      return {
        success: false,
        error: 'Insufficient data for prediction',
      };
    }

    // Calculate technical indicators
    const technical = calculateTechnicalIndicators(history, stock);
    
    // Combine sentiment + technical analysis for signal
    const signal = generateSignal(technical, sentiment);
    const recommendation = generateRecommendation(signal, sentiment, technical, stock);
    
    // Calculate price targets and stop loss
    const priceTargets = calculatePriceTargets(stock, technical, signal);
    
    // Calculate confidence and risk
    const { confidence, riskLevel } = calculateConfidenceAndRisk(technical, sentiment, signal);
    
    // Prepare technical reasons
    const reasons = getTechnicalReasons(technical, stock);

    // Prepare sentiment-based reasons for transparency
    const sentimentReasons = [];
    if (sentiment.avgSentiment > 0.2) sentimentReasons.push('Positive news sentiment supports bullish bias');
    else if (sentiment.avgSentiment < -0.2) sentimentReasons.push('Negative news sentiment supports bearish bias');
    else sentimentReasons.push('News sentiment is neutral');

    const explanation = [
      ...reasons.slice(0, 3),
      ...sentimentReasons,
    ];
    
    return {
      success: true,
      symbol,
      prediction: {
        signal: signal.signal,
        confidence,
        riskLevel,
      },
      priceTargets,
      recommendation,
      explanation,
      technical: {
        rsi: parseFloat(technical.rsi.toFixed(2)),
        macd: {
          line: parseFloat(technical.macd.line.toFixed(2)),
          signal: parseFloat(technical.macd.signal.toFixed(2)),
          histogram: parseFloat(technical.macd.histogram.toFixed(2)),
        },
        movingAverages: {
          ma20: parseFloat(technical.ma20.toFixed(2)),
          ma50: parseFloat(technical.ma50.toFixed(2)),
          ma200: parseFloat(technical.ma200.toFixed(2)),
        },
        support: parseFloat(technical.support.toFixed(2)),
        resistance: parseFloat(technical.resistance.toFixed(2)),
        trend: technical.trend,
        reasons: reasons.slice(0, 3),
      },
      sentiment: {
        score: parseFloat(sentiment.avgSentiment.toFixed(3)),
        totalMentions: sentiment.totalMentions,
        positivePercent: sentiment.positivePercentage,
        negativePercent: sentiment.negativePercentage,
        signal: sentiment.sentimentTrend.toUpperCase(),
      },
      timestamp: new Date(),
    };
  } catch (error) {
    console.error(`Error generating prediction for ${symbol}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Calculate technical indicators from historical data
 */
function calculateTechnicalIndicators(history, stock) {
  const closes = history.map(h => h.close).filter(c => c > 0);
  
  if (closes.length < 20) {
    return {
      rsi: 50,
      macd: { line: 0, signal: 0, histogram: 0 },
      ma20: closes[closes.length - 1],
      ma50: closes[closes.length - 1],
      ma200: closes[closes.length - 1],
      support: Math.min(...closes),
      resistance: Math.max(...closes),
      trend: 'NEUTRAL',
      volatility: 0,
      momentum: 0,
    };
  }

  // Calculate Simple Moving Averages (SMA)
  const ma20 = calculateSMA(closes, 20);
  const ma50 = calculateSMA(closes, Math.min(50, closes.length));
  const ma200 = calculateSMA(closes, Math.min(200, closes.length));

  // Calculate RSI (Relative Strength Index)
  const rsi = calculateRSI(closes, 14);

  // Calculate MACD
  const macd = calculateMACD(closes);

  // Calculate Support and Resistance
  const support = calculateSupport(closes);
  const resistance = calculateResistance(closes);

  // Determine trend
  const currentPrice = closes[closes.length - 1];
  let trend = 'NEUTRAL';
  if (currentPrice > ma20 && ma20 > ma50) {
    trend = 'UPTREND';
  } else if (currentPrice < ma20 && ma20 < ma50) {
    trend = 'DOWNTREND';
  }

  // Calculate volatility
  const volatility = calculateVolatility(closes);

  // Calculate momentum
  const momentum = closes[closes.length - 1] - closes[Math.max(0, closes.length - 5)];

  return {
    rsi,
    macd,
    ma20,
    ma50,
    ma200,
    support,
    resistance,
    trend,
    volatility,
    momentum,
  };
}

/**
 * Simple Moving Average
 */
function calculateSMA(data, period) {
  if (data.length < period) {
    return data.reduce((a, b) => a + b, 0) / data.length;
  }
  
  const subset = data.slice(-period);
  return subset.reduce((a, b) => a + b, 0) / period;
}

/**
 * RSI (Relative Strength Index)
 */
function calculateRSI(data, period = 14) {
  if (data.length < period) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i < period; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  gains /= period;
  losses /= period;

  let rs = gains / (losses || 1);
  return 100 - (100 / (1 + rs));
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
function calculateMACD(data) {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  const line = ema12 - ema26;
  
  // Signal line is EMA(9) of MACD line
  const macdValues = [];
  for (let i = 0; i < data.length; i++) {
    const e12 = calculateEMAAt(data, i, 12);
    const e26 = calculateEMAAt(data, i, 26);
    macdValues.push(e12 - e26);
  }
  
  const signal = calculateEMAAt(macdValues, macdValues.length - 1, 9);
  const histogram = line - signal;

  return { line, signal, histogram };
}

/**
 * Calculate EMA
 */
function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  let ema = data[0];

  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }

  return ema;
}

/**
 * Calculate EMA at specific index
 */
function calculateEMAAt(data, index, period) {
  if (index < period) {
    return data.slice(0, index + 1).reduce((a, b) => a + b, 0) / (index + 1);
  }

  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i <= index; i++) {
    ema = data[i] * k + ema * (1 - k);
  }

  return ema;
}

/**
 * Calculate Support Level (lowest point)
 */
function calculateSupport(data) {
  return Math.min(...data);
}

/**
 * Calculate Resistance Level (highest point)
 */
function calculateResistance(data) {
  return Math.max(...data);
}

/**
 * Calculate Volatility (standard deviation)
 */
function calculateVolatility(data) {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  return Math.sqrt(variance);
}

/**
 * Generate trading signal
 */
function generateSignal(technical, sentiment) {
  let score = 0;
  let reasons = [];

  // RSI signals
  if (technical.rsi < 30) {
    score += 2;
    reasons.push('RSI oversold');
  } else if (technical.rsi > 70) {
    score -= 2;
    reasons.push('RSI overbought');
  } else if (technical.rsi < 40) {
    score += 1;
  } else if (technical.rsi > 60) {
    score -= 1;
  }

  // MACD signals
  if (technical.macd.histogram > 0 && technical.macd.line > technical.macd.signal) {
    score += 1.5;
    reasons.push('MACD bullish crossover');
  } else if (technical.macd.histogram < 0 && technical.macd.line < technical.macd.signal) {
    score -= 1.5;
    reasons.push('MACD bearish crossover');
  }

  // Moving Average signals
  if (technical.trend === 'UPTREND') {
    score += 1;
  } else if (technical.trend === 'DOWNTREND') {
    score -= 1;
  }

  // Sentiment signals
  if (sentiment.avgSentiment > 0.3) {
    score += 1.5;
    reasons.push('Very bullish sentiment');
  } else if (sentiment.avgSentiment > 0.1) {
    score += 0.5;
    reasons.push('Bullish sentiment');
  } else if (sentiment.avgSentiment < -0.3) {
    score -= 1.5;
    reasons.push('Very bearish sentiment');
  } else if (sentiment.avgSentiment < -0.1) {
    score -= 0.5;
    reasons.push('Bearish sentiment');
  }

  // Volume/volatility signals
  if (technical.volatility > 5) {
    score -= 0.5;
    reasons.push('High volatility - risky');
  }

  // Determine signal
  let signal = 'HOLD';
  if (score >= 3) signal = 'STRONG BUY';
  else if (score >= 1.5) signal = 'BUY';
  else if (score >= 0.5) signal = 'BUY';
  else if (score <= -3) signal = 'STRONG SELL';
  else if (score <= -1.5) signal = 'SELL';
  else if (score <= -0.5) signal = 'SELL';
  else signal = 'HOLD';

  return { signal, score, reasons };
}

/**
 * Calculate confidence level
 */
function calculateConfidenceAndRisk(technical, sentiment, signal) {
  // Base confidence from indicator agreement
  let confidence = 50; // Base 50%
  let scoreWeight = Math.abs(signal.score) * 10;
  confidence = Math.min(95, Math.max(55, confidence + scoreWeight));

  // Adjust for sentiment strength
  const sentimentStrength = Math.abs(sentiment.avgSentiment) * 20;
  confidence = Math.min(95, confidence + (sentimentStrength * 0.15));

  // Risk level based on volatility and RSI
  let riskLevel = 'MEDIUM';
  if (technical.volatility > 8 || technical.rsi > 75 || technical.rsi < 25) {
    riskLevel = 'HIGH';
  } else if (technical.volatility < 2 && technical.rsi >= 40 && technical.rsi <= 60) {
    riskLevel = 'LOW';
  }

  return {
    confidence: Math.round(confidence),
    riskLevel,
  };
}

/**
 * Calculate price targets and stop loss
 */
function calculatePriceTargets(stock, technical, signal) {
  const currentPrice = stock.currentPrice;
  const atr = technical.resistance - technical.support;

  let target1, target2, stopLoss;

  if (signal.signal.includes('BUY')) {
    // Buy scenario
    target1 = currentPrice + (atr * 0.6);
    target2 = currentPrice + (atr * 1.2);
    stopLoss = currentPrice - (atr * 0.3);
  } else if (signal.signal.includes('SELL')) {
    // Sell scenario
    target1 = currentPrice - (atr * 0.6);
    target2 = currentPrice - (atr * 1.2);
    stopLoss = currentPrice + (atr * 0.3);
  } else {
    // Hold scenario
    target1 = currentPrice + (atr * 0.3);
    stopLoss = currentPrice - (atr * 0.2);
  }

  return {
    target1: Math.max(0, parseFloat(target1.toFixed(2))),
    target2: Math.max(0, parseFloat(target2.toFixed(2))),
    stopLoss: Math.max(0, parseFloat(stopLoss.toFixed(2))),
  };
}

/**
 * Generate investment recommendation text
 */
function generateRecommendation(signal, sentiment, technical, stock) {
  const signalText = signal.signal;
  const sentimentText = sentiment.sentimentTrend;
  const trendText = technical.trend;

  let recommendation = '';

  if (signalText.includes('BUY')) {
    recommendation = `Consider buying ${stock.name} (${stock.symbol}). `;
    
    if (sentiment.avgSentiment > 0.2) {
      recommendation += 'Market sentiment is positive with increasing mentions. ';
    }
    
    if (technical.trend === 'UPTREND') {
      recommendation += 'Price is in an uptrend with support at ₹' + technical.support.toFixed(2) + '. ';
    }
    
    recommendation += `Target price: ₹${(stock.currentPrice * 1.1).toFixed(2)}. `;
    recommendation += 'Monitor for breaks above resistance levels.';
  } else if (signalText.includes('SELL')) {
    recommendation = `Consider selling or avoiding ${stock.name} (${stock.symbol}). `;
    
    if (sentiment.avgSentiment < -0.2) {
      recommendation += 'Negative sentiment detected in news. ';
    }
    
    if (technical.trend === 'DOWNTREND') {
      recommendation += 'Price is in a downtrend. ';
    }
    
    recommendation += 'Reduce exposure and set stop-loss. ';
    recommendation += `Watch for support at ₹${technical.support.toFixed(2)}.`;
  } else {
    recommendation = `Hold position in ${stock.name} (${stock.symbol}). `;
    recommendation += 'Sentiment is mixed. ';
    
    if (technical.volatility > 5) {
      recommendation += 'Wait for volatility to decrease before making moves.';
    } else {
      recommendation += 'Monitor for clear break above or below key levels.';
    }
  }

  return recommendation;
}

/**
 * Get technical reasons for the signal
 */
function getTechnicalReasons(technical, stock) {
  const reasons = [];

  // RSI reasons
  if (technical.rsi < 30) {
    reasons.push('Stock is oversold (RSI < 30) - potential bounce');
  } else if (technical.rsi > 70) {
    reasons.push('Stock is overbought (RSI > 70) - potential pullback');
  } else if (technical.rsi < 50) {
    reasons.push('RSI below 50 - slight downward momentum');
  } else {
    reasons.push('RSI above 50 - slight upward momentum');
  }

  // Trend reasons
  if (technical.trend === 'UPTREND') {
    reasons.push('Price in established uptrend - bullish');
  } else if (technical.trend === 'DOWNTREND') {
    reasons.push('Price in established downtrend - bearish');
  } else {
    reasons.push('No clear trend - consolidation phase');
  }

  // MACD reasons
  if (technical.macd.histogram > 0) {
    reasons.push('MACD histogram positive - bullish momentum');
  } else if (technical.macd.histogram < 0) {
    reasons.push('MACD histogram negative - bearish momentum');
  }

  // Volatility reasons
  if (technical.volatility > 8) {
    reasons.push('High volatility detected - increased risk');
  } else if (technical.volatility < 2) {
    reasons.push('Low volatility - stable conditions');
  }

  // Distance from MA
  const distFromMA20 = ((stock.currentPrice - technical.ma20) / technical.ma20) * 100;
  if (distFromMA20 > 5) {
    reasons.push(`Price ${distFromMA20.toFixed(1)}% above 20-day MA - potentially overextended`);
  } else if (distFromMA20 < -5) {
    reasons.push(`Price ${Math.abs(distFromMA20).toFixed(1)}% below 20-day MA - potentially undervalued`);
  }

  return reasons;
}

module.exports = {
  generatePrediction,
  calculateTechnicalIndicators,
  generateSignal,
  calculateConfidenceAndRisk,
  calculatePriceTargets,
  generateRecommendation,
};
