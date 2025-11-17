// backend/services/newsService.js
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Fetch news from NewsAPI (Free tier: 100 requests/day)
 * You need to sign up at https://newsapi.org/ for API key
 */
async function fetchNewsFromAPI(stockName) {
  try {
    const apiKey = process.env.NEWS_API_KEY || 'your_newsapi_key_here';
    
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: stockName,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 10,
        apiKey: apiKey,
      }
    });
    
    return response.data.articles.map(article => ({
      title: article.title,
      description: article.description,
      url: article.url,
      source: article.source.name,
      publishedAt: new Date(article.publishedAt),
    }));
  } catch (error) {
    console.error('NewsAPI error:', error.message);
    return [];
  }
}

/**
 * Scrape news from MoneyControl (Free, no API key needed)
 */
async function scrapeMoneyControl(stockSymbol) {
  try {
    // Remove .NS suffix for search
    const cleanSymbol = stockSymbol.replace('.NS', '').replace('.BO', '');
    
    const response = await axios.get(`https://www.moneycontrol.com/news/tags/${cleanSymbol.toLowerCase()}.html`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 5000,
    });
    
    const $ = cheerio.load(response.data);
    const articles = [];
    
    $('.clearfix').each((i, elem) => {
      if (i >= 10) return false; // Limit to 10 articles
      
      const title = $(elem).find('h2 a').text().trim();
      const url = $(elem).find('h2 a').attr('href');
      const description = $(elem).find('p').text().trim();
      
      if (title && url) {
        articles.push({
          title,
          description,
          url,
          source: 'MoneyControl',
          publishedAt: new Date(),
        });
      }
    });
    
    return articles;
  } catch (error) {
    console.error('MoneyControl scraping error:', error.message);
    return [];
  }
}

/**
 * Scrape news from Economic Times (Free, no API key needed)
 */
async function scrapeEconomicTimes(stockName) {
  try {
    const searchUrl = `https://economictimes.indiatimes.com/topic/${stockName.toLowerCase().replace(/\s+/g, '-')}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 5000,
    });
    
    const $ = cheerio.load(response.data);
    const articles = [];
    
    $('.eachStory').each((i, elem) => {
      if (i >= 10) return false;
      
      const title = $(elem).find('h3').text().trim();
      const url = $(elem).find('a').attr('href');
      const description = $(elem).find('p').text().trim();
      
      if (title && url) {
        articles.push({
          title,
          description,
          url: url.startsWith('http') ? url : `https://economictimes.indiatimes.com${url}`,
          source: 'Economic Times',
          publishedAt: new Date(),
        });
      }
    });
    
    return articles;
  } catch (error) {
    console.error('Economic Times scraping error:', error.message);
    return [];
  }
}

/**
 * Fetch news from Google News RSS (Free)
 */
async function fetchGoogleNews(stockName) {
  try {
    const Parser = require('rss-parser');
    const parser = new Parser();
    
    const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(stockName + ' stock india')}&hl=en-IN&gl=IN&ceid=IN:en`;
    
    const feed = await parser.parseURL(feedUrl);
    
    return feed.items.slice(0, 10).map(item => ({
      title: item.title,
      description: item.contentSnippet || '',
      url: item.link,
      source: 'Google News',
      publishedAt: new Date(item.pubDate),
    }));
  } catch (error) {
    console.error('Google News RSS error:', error.message);
    return [];
  }
}

/**
 * Main function to fetch news from multiple sources
 */
async function fetchNewsForStock(symbol) {
  // Get stock name without exchange suffix
  const stockName = symbol.replace('.NS', '').replace('.BO', '');
  
  try {
    // Try multiple sources in parallel
    const [googleNews, moneyControlNews, etNews] = await Promise.allSettled([
      fetchGoogleNews(stockName),
      scrapeMoneyControl(symbol),
      scrapeEconomicTimes(stockName),
    ]);
    
    let allArticles = [];
    
    if (googleNews.status === 'fulfilled') allArticles.push(...googleNews.value);
    if (moneyControlNews.status === 'fulfilled') allArticles.push(...moneyControlNews.value);
    if (etNews.status === 'fulfilled') allArticles.push(...etNews.value);
    
    // Remove duplicates based on title
    const uniqueArticles = allArticles.reduce((acc, current) => {
      const exists = acc.find(item => item.title === current.title);
      if (!exists) {
        acc.push(current);
      }
      return acc;
    }, []);
    
    return uniqueArticles.slice(0, 20); // Return max 20 articles
  } catch (error) {
    console.error(`Error fetching news for ${symbol}:`, error);
    return [];
  }
}

/**
 * Fetch latest market news (general)
 */
async function fetchLatestMarketNews() {
  try {
    const news = await fetchGoogleNews('indian stock market');
    return news;
  } catch (error) {
    console.error('Error fetching market news:', error);
    return [];
  }
}

module.exports = {
  fetchNewsForStock,
  fetchLatestMarketNews,
  scrapeMoneyControl,
  scrapeEconomicTimes,
  fetchGoogleNews,
};