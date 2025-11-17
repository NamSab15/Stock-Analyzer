// backend/services/stockService.js - ENHANCED VERSION
const axios = require('axios');
const { Stock } = require('../models/Stock');

// Comprehensive list of Indian stocks
const INDIAN_STOCKS = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd', exchange: 'NSE', sector: 'Energy' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services Ltd', exchange: 'NSE', sector: 'IT' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Ltd', exchange: 'NSE', sector: 'Banking' },
  { symbol: 'INFY.NS', name: 'Infosys Ltd', exchange: 'NSE', sector: 'IT' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Ltd', exchange: 'NSE', sector: 'Banking' },
  { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever Ltd', exchange: 'NSE', sector: 'FMCG' },
  { symbol: 'ITC.NS', name: 'ITC Ltd', exchange: 'NSE', sector: 'FMCG' },
  { symbol: 'SBIN.NS', name: 'State Bank of India', exchange: 'NSE', sector: 'Banking' },
  { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel Ltd', exchange: 'NSE', sector: 'Telecom' },
  { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank Ltd', exchange: 'NSE', sector: 'Banking' },
  { symbol: 'LT.NS', name: 'Larsen & Toubro Ltd', exchange: 'NSE', sector: 'Infrastructure' },
  { symbol: 'AXISBANK.NS', name: 'Axis Bank Ltd', exchange: 'NSE', sector: 'Banking' },
  { symbol: 'WIPRO.NS', name: 'Wipro Ltd', exchange: 'NSE', sector: 'IT' },
  { symbol: 'ADANIENT.NS', name: 'Adani Enterprises Ltd', exchange: 'NSE', sector: 'Diversified' },
  { symbol: 'TATAMOTORS.NS', name: 'Tata Motors Ltd', exchange: 'NSE', sector: 'Automobile' },
  { symbol: 'ASIANPAINT.NS', name: 'Asian Paints Ltd', exchange: 'NSE', sector: 'Paints' },
  { symbol: 'MARUTI.NS', name: 'Maruti Suzuki India Ltd', exchange: 'NSE', sector: 'Automobile' },
  { symbol: 'TITAN.NS', name: 'Titan Company Ltd', exchange: 'NSE', sector: 'Jewellery' },
  { symbol: 'SUNPHARMA.NS', name: 'Sun Pharmaceutical Industries Ltd', exchange: 'NSE', sector: 'Pharma' },
  { symbol: 'ULTRACEMCO.NS', name: 'UltraTech Cement Ltd', exchange: 'NSE', sector: 'Cement' },
  { symbol: 'NESTLEIND.NS', name: 'Nestle India Ltd', exchange: 'NSE', sector: 'FMCG' },
  { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance Ltd', exchange: 'NSE', sector: 'Finance' },
  { symbol: 'HCLTECH.NS', name: 'HCL Technologies Ltd', exchange: 'NSE', sector: 'IT' },
  { symbol: 'TECHM.NS', name: 'Tech Mahindra Ltd', exchange: 'NSE', sector: 'IT' },
  { symbol: 'POWERGRID.NS', name: 'Power Grid Corporation of India Ltd', exchange: 'NSE', sector: 'Power' },
];

/**
 * Fetch real-time stock data from Yahoo Finance
 */
async function fetchStockData(symbol) {
  try {
    // Method 1: Yahoo Finance Query API
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const response = await axios.get(url, {
      params: {
        interval: '1d',
        range: '5d'
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const data = response.data.chart.result[0];
    const meta = data.meta;
    const quote = data.indicators.quote[0];
    const timestamps = data.timestamp;

    // Get latest values
    const latestIndex = quote.close.length - 1;
    const currentPrice = quote.close[latestIndex];
    const previousClose = meta.chartPreviousClose || meta.previousClose;
    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;

    // Calculate additional metrics
    const high52Week = Math.max(...quote.high.filter(v => v !== null));
    const low52Week = Math.min(...quote.low.filter(v => v !== null));
    const avgVolume = quote.volume.filter(v => v !== null).reduce((a, b) => a + b, 0) / quote.volume.filter(v => v !== null).length;

    return {
      symbol: symbol,
      currentPrice: parseFloat(currentPrice?.toFixed(2)) || 0,
      previousClose: parseFloat(previousClose?.toFixed(2)) || 0,
      change: parseFloat(change?.toFixed(2)) || 0,
      changePercent: parseFloat(changePercent?.toFixed(2)) || 0,
      volume: quote.volume[latestIndex] || 0,
      marketCap: meta.marketCap || null,
      dayHigh: parseFloat(quote.high[latestIndex]?.toFixed(2)) || 0,
      dayLow: parseFloat(quote.low[latestIndex]?.toFixed(2)) || 0,
      high52Week: parseFloat(high52Week?.toFixed(2)) || 0,
      low52Week: parseFloat(low52Week?.toFixed(2)) || 0,
      avgVolume: Math.round(avgVolume) || 0,
      lastUpdated: new Date(),
      currency: meta.currency || 'INR',
      marketState: meta.marketState || 'REGULAR',
    };
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error.message);
    
    // Fallback: Try alternative API
    try {
      return await fetchStockDataAlternative(symbol);
    } catch (fallbackError) {
      console.error(`Fallback also failed for ${symbol}`);
      return null;
    }
  }
}

/**
 * Alternative method using Yahoo Finance v7 API
 */
async function fetchStockDataAlternative(symbol) {
  try {
    const url = `https://query2.finance.yahoo.com/v7/finance/quote`;
    const response = await axios.get(url, {
      params: {
        symbols: symbol,
        fields: 'symbol,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,marketCap,regularMarketPreviousClose,regularMarketDayHigh,regularMarketDayLow,fiftyTwoWeekHigh,fiftyTwoWeekLow,averageVolume'
      },
      timeout: 10000
    });

    const quote = response.data.quoteResponse.results[0];
    
    if (!quote) return null;

    return {
      symbol: symbol,
      currentPrice: quote.regularMarketPrice || 0,
      previousClose: quote.regularMarketPreviousClose || 0,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      volume: quote.regularMarketVolume || 0,
      marketCap: quote.marketCap || null,
      dayHigh: quote.regularMarketDayHigh || 0,
      dayLow: quote.regularMarketDayLow || 0,
      high52Week: quote.fiftyTwoWeekHigh || 0,
      low52Week: quote.fiftyTwoWeekLow || 0,
      avgVolume: quote.averageVolume || 0,
      lastUpdated: new Date(),
      currency: 'INR',
      marketState: 'REGULAR',
    };
  } catch (error) {
    console.error(`Alternative API failed for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Update all stocks in database
 */
async function updateAllStocks() {
  console.log('📈 Updating stock data for', INDIAN_STOCKS.length, 'stocks...');
  
  let successCount = 0;
  let failCount = 0;

  for (const stockInfo of INDIAN_STOCKS) {
    try {
      const stockData = await fetchStockData(stockInfo.symbol);
      
      if (stockData && stockData.currentPrice > 0) {
        await Stock.findOneAndUpdate(
          { symbol: stockInfo.symbol },
          {
            ...stockData,
            name: stockInfo.name,
            exchange: stockInfo.exchange,
            sector: stockInfo.sector,
          },
          { upsert: true, new: true }
        );
        successCount++;
        console.log(`✅ ${stockInfo.symbol}: ₹${stockData.currentPrice}`);
      } else {
        failCount++;
        console.log(`⚠️  ${stockInfo.symbol}: No data`);
      }
      
      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      failCount++;
      console.error(`❌ ${stockInfo.symbol}:`, error.message);
    }
  }
  
  console.log(`\n✅ Update complete: ${successCount} success, ${failCount} failed`);
  return { successCount, failCount };
}

/**
 * Get historical price data
 */
async function getHistoricalData(symbol, days = 30) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const response = await axios.get(url, {
      params: {
        interval: days <= 7 ? '1h' : '1d',
        range: `${days}d`
      },
      timeout: 10000
    });

    const data = response.data.chart.result[0];
    const timestamps = data.timestamp;
    const quotes = data.indicators.quote[0];

    return timestamps.map((time, index) => ({
      timestamp: new Date(time * 1000),
      date: new Date(time * 1000).toISOString().split('T')[0],
      open: quotes.open[index] || 0,
      high: quotes.high[index] || 0,
      low: quotes.low[index] || 0,
      close: quotes.close[index] || 0,
      volume: quotes.volume[index] || 0,
    })).filter(item => item.close > 0);
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error.message);
    return [];
  }
}

/**
 * Search stocks with autocomplete
 */
async function searchStocks(query) {
  try {
    if (!query || query.length < 1) {
      return INDIAN_STOCKS.slice(0, 10).map(s => ({
        symbol: s.symbol,
        name: s.name,
        exchange: s.exchange,
        sector: s.sector
      }));
    }

    const regex = new RegExp(query, 'i');
    
    // First try database
    const dbResults = await Stock.find({
      $or: [
        { symbol: regex },
        { name: regex },
        { sector: regex }
      ]
    }).limit(10);

    if (dbResults.length > 0) {
      return dbResults;
    }

    // Fallback to static list
    return INDIAN_STOCKS.filter(stock => 
      stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
      stock.name.toLowerCase().includes(query.toLowerCase()) ||
      stock.sector.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10);
  } catch (error) {
    console.error('Error searching stocks:', error);
    return [];
  }
}

/**
 * Get intraday data for charts
 */
async function getIntradayData(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const response = await axios.get(url, {
      params: {
        interval: '5m',
        range: '1d'
      }
    });

    const data = response.data.chart.result[0];
    const timestamps = data.timestamp;
    const quotes = data.indicators.quote[0];

    return timestamps.map((time, index) => ({
      time: new Date(time * 1000).toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      price: quotes.close[index] || 0,
      volume: quotes.volume[index] || 0,
    })).filter(item => item.price > 0);
  } catch (error) {
    console.error(`Error fetching intraday data for ${symbol}:`, error.message);
    return [];
  }
}

/**
 * Initialize stocks on server start
 */
async function initializeStocks() {
  console.log('🔄 Initializing stock database...');
  
  // First, insert all stock info without prices
  for (const stock of INDIAN_STOCKS) {
    await Stock.findOneAndUpdate(
      { symbol: stock.symbol },
      {
        symbol: stock.symbol,
        name: stock.name,
        exchange: stock.exchange,
        sector: stock.sector,
        currentPrice: 0,
        lastUpdated: new Date()
      },
      { upsert: true }
    );
  }
  
  console.log(`✅ Initialized ${INDIAN_STOCKS.length} stocks`);
  
  // Then update with real prices
  await updateAllStocks();
  
  // Schedule regular updates (every 5 minutes during market hours)
  setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const minute = now.getMinutes();
    
    // Indian market hours: 9:15 AM to 3:30 PM IST (Monday-Friday)
    const isMarketHours = day >= 1 && day <= 5 && 
                          ((hour === 9 && minute >= 15) || (hour >= 10 && hour < 15) || 
                           (hour === 15 && minute <= 30));
    
    if (isMarketHours) {
      console.log('🔄 Auto-updating stock prices (market hours)...');
      await updateAllStocks();
    }
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Get all available stocks list
 */
function getAllStocksList() {
  return INDIAN_STOCKS;
}

module.exports = {
  INDIAN_STOCKS,
  fetchStockData,
  updateAllStocks,
  getHistoricalData,
  searchStocks,
  getIntradayData,
  initializeStocks,
  getAllStocksList,
};

/**
 * Search Yahoo Finance for matching symbols/names
 */
async function searchYahoo(query) {
  try {
    const url = 'https://query2.finance.yahoo.com/v1/finance/search';
    const resp = await axios.get(url, { params: { q: query, quotesCount: 10, newsCount: 0 }, timeout: 8000 });
    const results = resp.data.quotes || [];
    return results.map(r => ({
      symbol: r.symbol,
      name: r.shortname || r.longname || r.exchDisp || r.symbol,
      exchange: (r.exchange === 'NSE' || (r.symbol && r.symbol.endsWith('.NS'))) ? 'NSE' : (r.exchange || 'UNKNOWN')
    }));
  } catch (error) {
    console.error('Yahoo search failed:', error.message);
    return [];
  }
}

// export helper
module.exports.searchYahoo = searchYahoo;