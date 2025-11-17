import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Search, Activity, AlertCircle, CheckCircle, XCircle, BarChart3, DollarSign, Clock, Newspaper } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';
const WS_URL = 'ws://localhost:5000';

function App() {
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [sentimentData, setSentimentData] = useState({});
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [newsItems, setNewsItems] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const ws = useRef(null);
  const searchTimeoutRef = useRef(null);

  // WebSocket connection
  useEffect(() => {
    connectWebSocket();
    return () => ws.current?.close();
  }, []);

  const connectWebSocket = () => {
    ws.current = new WebSocket(WS_URL);
    
    ws.current.onopen = () => {
      console.log('WebSocket Connected');
      setWsConnected(true);
    };
    
    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };
    
    ws.current.onerror = () => setWsConnected(false);
    ws.current.onclose = () => {
      setWsConnected(false);
      setTimeout(connectWebSocket, 5000);
    };
  };

  const handleWebSocketMessage = (message) => {
    if (message.type === 'initial_data' || message.type === 'stock_update') {
      const data = message.data;
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item.stock) {
            setStocks(prev => {
              const index = prev.findIndex(s => s.symbol === item.stock.symbol);
              if (index !== -1) {
                const newStocks = [...prev];
                newStocks[index] = item.stock;
                return newStocks;
              }
              return [...prev, item.stock];
            });
            
            if (item.sentiment) {
              setSentimentData(prev => ({
                ...prev,
                [item.stock.symbol]: item.sentiment
              }));
            }
          }
        });
      }
    }
  };

  // Fetch initial data
  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    try {
      const response = await fetch(`${API_URL}/stocks`);
      const data = await response.json();
      if (data.success) {
        setStocks(data.data);
        data.data.forEach(stock => fetchSentiment(stock.symbol));
      }
    } catch (error) {
      console.error('Error fetching stocks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSentiment = async (symbol) => {
    try {
      const response = await fetch(`${API_URL}/sentiment/${symbol}?hours=72`);
      const data = await response.json();
      if (data.success && data.data) {
        setSentimentData(prev => ({
          ...prev,
          [symbol]: data.data
        }));
      }
    } catch (error) {
      console.error(`Error fetching sentiment for ${symbol}:`, error);
    }
  };

  const fetchNews = async (symbol) => {
    try {
      const response = await fetch(`${API_URL}/stocks/${symbol}/news?limit=10`);
      const data = await response.json();
      if (data.success) {
        setNewsItems(data.data);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      setNewsItems([]);
    }
  };

  const fetchPrediction = async (symbol) => {
    try {
      setLoadingPrediction(true);
      const response = await fetch(`${API_URL}/stocks/${symbol}/prediction`);
      const data = await response.json();
      if (data.success) {
        setPrediction(data);
      }
    } catch (error) {
      console.error('Error fetching prediction:', error);
    } finally {
      setLoadingPrediction(false);
    }
  };

  // Search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.length >= 1) {
      setShowSearchDropdown(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(`${API_URL}/stocks/search?q=${encodeURIComponent(searchQuery)}`);
          const data = await response.json();
          if (data.success) {
            setSearchResults(data.data);
          }
        } catch (error) {
          console.error('Search error:', error);
        }
      }, 300);
    } else {
      setShowSearchDropdown(false);
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleStockSelect = (stock) => {
    setSelectedStock(stock);
    setNewsItems([]);
    setPrediction(null);
    fetchNews(stock.symbol);
    fetchPrediction(stock.symbol);
    fetchSentiment(stock.symbol);
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  const fetchStockDetails = async (symbol) => {
    try {
      const res = await fetch(`${API_URL}/stocks/${symbol}`);
      const data = await res.json();
      if (data.success && data.data) return data.data;
      return null;
    } catch (err) {
      return null;
    }
  };

  const handleSearchSelect = async (result) => {
    // Try to find in loaded stocks
    let stock = stocks.find(s => s.symbol === result.symbol);

    if (!stock) {
      // Try to fetch full details from backend
      const details = await fetchStockDetails(result.symbol);
      if (details) stock = details;
      else {
        // Fall back to minimal object
        stock = result;
      }
    }

    handleStockSelect(stock);
  };

  const getSentimentColor = (score) => {
    if (score > 0.2) return 'text-green-600';
    if (score < -0.2) return 'text-red-600';
    return 'text-gray-600';
  };

  const getSentimentBg = (score) => {
    if (score > 0.2) return 'bg-green-50 border-green-200';
    if (score < -0.2) return 'bg-red-50 border-red-200';
    return 'bg-gray-50 border-gray-200';
  };

  const getSentimentIcon = (score) => {
    if (score > 0.2) return <TrendingUp className="w-4 h-4" />;
    if (score < -0.2) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getSignalIcon = (signal) => {
    if (signal.includes('BUY')) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (signal.includes('SELL')) return <XCircle className="w-5 h-5 text-red-600" />;
    return <AlertCircle className="w-5 h-5 text-gray-600" />;
  };

  const getSignalColor = (signal) => {
    if (signal.includes('BUY')) return 'bg-green-50 border-green-300 text-green-800';
    if (signal.includes('SELL')) return 'bg-red-50 border-red-300 text-red-800';
    return 'bg-gray-50 border-gray-300 text-gray-800';
  };

  const filteredStocks = stocks.filter(stock =>
    stock.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stock.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show only top 5 by default in the sidebar; full results available via search
  const displayedStocks = searchQuery ? filteredStocks : stocks.slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading Indian Stock Market Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-indigo-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Indian Stock Sentiment Analyzer</h1>
                <p className="text-sm text-gray-600">Real-time NSE/BSE sentiment + AI predictions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${wsConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs font-medium">{wsConnected ? 'Live' : 'Disconnected'}</span>
              </div>
              <button onClick={fetchStocks} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <RefreshCw className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Top search area (large rounded search card like screenshot) */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 py-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-gray-400" />
              <input
                type="text"
                placeholder="Search stocks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery && setShowSearchDropdown(true)}
                className="w-full pl-14 pr-4 py-4 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stock List */}
          <div className={selectedStock ? 'lg:col-span-1 space-y-4' : 'hidden'}>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search stocks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery && setShowSearchDropdown(true)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                
                {/* Search Dropdown */}
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                    {searchResults.map((result, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSearchSelect(result)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <div className="font-semibold text-gray-900">{result.symbol?.replace('.NS', '')}</div>
                        <div className="text-sm text-gray-600 truncate">{result.name}</div>
                        {result.sector && (
                          <div className="text-xs text-indigo-600 mt-1">{result.sector}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {displayedStocks.map(stock => {
                  const sentiment = sentimentData[stock.symbol];
                  const isSelected = selectedStock?.symbol === stock.symbol;
                  
                  return (
                    <button
                      key={stock.symbol}
                      onClick={() => handleStockSelect(stock)}
                      className={`w-full text-left p-3 rounded-lg border transition ${
                        isSelected 
                          ? 'bg-indigo-50 border-indigo-300' 
                          : 'bg-white border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-gray-900">{stock.symbol?.replace('.NS', '')}</div>
                          <div className="text-xs text-gray-600 truncate max-w-[150px]">{stock.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg text-gray-900">
                            ₹{stock.currentPrice > 0 ? stock.currentPrice.toFixed(2) : '--'}
                          </div>
                          <div className={`text-sm font-bold flex items-center justify-end gap-1 ${stock.change >= 0 ? 'text-green-600 bg-green-50 px-2 py-1 rounded' : 'text-red-600 bg-red-50 px-2 py-1 rounded'}`}>
                            {stock.change >= 0 ? '▲' : '▼'} {Math.abs(stock.changePercent || 0).toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      
                      {sentiment && sentiment.dataAvailable && (
                        <div className={`flex items-center justify-between text-xs p-2 rounded border ${getSentimentBg(sentiment.avgSentiment)}`}>
                          <span className="font-medium text-gray-700">Sentiment</span>
                          <div className={`flex items-center gap-1 ${getSentimentColor(sentiment.avgSentiment)}`}>
                            {getSentimentIcon(sentiment.avgSentiment)}
                            <span className="font-semibold">{sentiment.avgSentiment.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {selectedStock ? (
              <>
                {/* Stock Details */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{selectedStock.name}</h2>
                      <p className="text-gray-600">{selectedStock.symbol} · {selectedStock.exchange}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold text-gray-900">
                        ₹{selectedStock.currentPrice > 0 ? selectedStock.currentPrice.toFixed(2) : '--'}
                      </div>
                      <div className={`text-xl font-bold flex items-center justify-end gap-2 px-3 py-2 rounded-lg ${selectedStock.change >= 0 ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                        {selectedStock.change >= 0 ? '▲' : '▼'} {selectedStock.change >= 0 ? '+' : ''}{selectedStock.change?.toFixed(2)} ({Math.abs(selectedStock.changePercent || 0).toFixed(2)}%)
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                      <div className="text-sm text-blue-700 font-semibold">Volume</div>
                      <div className="text-xl font-bold text-blue-900">
                        {(selectedStock.volume / 1000000).toFixed(2)}M
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                      <div className="text-sm text-purple-700 font-semibold">Day High</div>
                      <div className="text-lg font-bold text-green-600">₹{selectedStock.dayHigh?.toFixed(2) || '--'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                      <div className="text-sm text-orange-700 font-semibold">Day Low</div>
                      <div className="text-lg font-bold text-red-600">₹{selectedStock.dayLow?.toFixed(2) || '--'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-700 font-semibold">Prev Close</div>
                      <div className="text-lg font-bold text-slate-900">₹{selectedStock.previousClose?.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {/* AI Prediction */}
                {loadingPrediction ? (
                  <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
                    <p className="text-gray-600">Generating AI prediction...</p>
                  </div>
                ) : prediction && prediction.success && (
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow-sm p-6 border-2 border-indigo-200">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="w-6 h-6 text-indigo-600" />
                      <h3 className="text-xl font-bold text-gray-900">AI Trading Recommendation</h3>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className={`p-4 rounded-lg border-2 ${getSignalColor(prediction.prediction.signal)}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {getSignalIcon(prediction.prediction.signal)}
                          <div className="text-sm font-medium">Signal</div>
                        </div>
                        <div className="text-2xl font-bold">{prediction.prediction.signal}</div>
                      </div>

                      <div className="p-4 rounded-lg border-2 bg-blue-50 border-blue-300">
                        <div className="text-sm font-medium text-blue-700 mb-2">Confidence</div>
                        <div className="text-2xl font-bold text-blue-900">{prediction.prediction.confidence}%</div>
                      </div>

                      <div className={`p-4 rounded-lg border-2 ${
                        prediction.prediction.riskLevel === 'HIGH' ? 'bg-red-50 border-red-300' :
                        prediction.prediction.riskLevel === 'MEDIUM' ? 'bg-yellow-50 border-yellow-300' :
                        'bg-green-50 border-green-300'
                      }`}>
                        <div className="text-sm font-medium text-gray-700 mb-2">Risk Level</div>
                        <div className="text-2xl font-bold">{prediction.prediction.riskLevel}</div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 mb-4">
                      <div className="text-sm font-semibold text-gray-700 mb-2">Recommendation:</div>
                      <p className="text-gray-900">{prediction.recommendation}</p>

                      {prediction.explanation && (
                        <div className="mt-3 text-sm text-gray-700">
                          <div className="font-medium mb-1">Why this prediction:</div>
                          <ul className="list-disc list-inside space-y-1">
                            {prediction.explanation.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {prediction.priceTargets && (
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {prediction.priceTargets.target1 && (
                          <div className="bg-white rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <DollarSign className="w-4 h-4 text-green-600" />
                              <div className="text-xs font-medium text-gray-600">Target Price</div>
                            </div>
                            <div className="text-lg font-bold text-green-600">₹{prediction.priceTargets.target1.toFixed(2)}</div>
                          </div>
                        )}
                        {prediction.priceTargets.stopLoss && (
                          <div className="bg-white rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <AlertCircle className="w-4 h-4 text-red-600" />
                              <div className="text-xs font-medium text-gray-600">Stop Loss</div>
                            </div>
                            <div className="text-lg font-bold text-red-600">₹{prediction.priceTargets.stopLoss.toFixed(2)}</div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs font-medium text-gray-600 mb-2">Technical Analysis</div>
                        <div className="space-y-1">
                          {prediction.technical.reasons.slice(0, 3).map((reason, idx) => (
                            <div key={idx} className="text-xs text-gray-700">• {reason}</div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs font-medium text-gray-600 mb-2">Sentiment Analysis</div>
                        <div className="space-y-1">
                          <div className="text-xs text-gray-700">Score: {prediction.sentiment.score}</div>
                          <div className="text-xs text-gray-700">Mentions: {prediction.sentiment.totalMentions}</div>
                          <div className="text-xs text-gray-700">Signal: {prediction.sentiment.signal}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sentiment Analysis */}
                {sentimentData[selectedStock.symbol] && sentimentData[selectedStock.symbol].dataAvailable && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Sentiment Analysis (72h)</h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className={`p-4 rounded-lg border-2 ${sentimentData[selectedStock.symbol].avgSentiment > 0.2 ? 'bg-green-100 border-green-500' : sentimentData[selectedStock.symbol].avgSentiment < -0.2 ? 'bg-red-100 border-red-500' : 'bg-gray-100 border-gray-400'}`}>
                        <div className="text-sm text-gray-600 mb-1">Average Sentiment</div>
                        <div className={`text-2xl font-bold ${sentimentData[selectedStock.symbol].avgSentiment > 0.2 ? 'text-green-700' : sentimentData[selectedStock.symbol].avgSentiment < -0.2 ? 'text-red-700' : 'text-gray-700'}`}>
                          {sentimentData[selectedStock.symbol].avgSentiment.toFixed(3)}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {sentimentData[selectedStock.symbol].sentimentTrend.toUpperCase()}
                        </div>
                      </div>
                      
                      <div className="p-4 rounded-lg border-2 border-indigo-300 bg-indigo-50">
                        <div className="text-sm text-indigo-600 mb-1">Total Mentions</div>
                        <div className="text-2xl font-bold text-indigo-900">
                          {sentimentData[selectedStock.symbol].totalMentions}
                        </div>
                        <div className="text-xs text-indigo-600 mt-1">News articles analyzed</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-green-100 border-2 border-green-500">
                        <div className="text-xs text-green-700 font-bold">🟢 Positive</div>
                        <div className="text-xl font-bold text-green-700">
                          {sentimentData[selectedStock.symbol].positiveCount}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          {sentimentData[selectedStock.symbol].positivePercentage}%
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-100 border-2 border-gray-400">
                        <div className="text-xs text-gray-700 font-bold">⚪ Neutral</div>
                        <div className="text-xl font-bold text-gray-700">
                          {sentimentData[selectedStock.symbol].neutralCount}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {sentimentData[selectedStock.symbol].neutralPercentage}%
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-red-100 border-2 border-red-500">
                        <div className="text-xs text-red-700 font-bold">🔴 Negative</div>
                        <div className="text-xl font-bold text-red-700">
                          {sentimentData[selectedStock.symbol].negativeCount}
                        </div>
                        <div className="text-xs text-red-600 mt-1">
                          {sentimentData[selectedStock.symbol].negativePercentage}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* News Feed */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Recent News & Analysis</h3>
                    <Clock className="w-5 h-5 text-gray-400" />
                  </div>
                  
                  {newsItems.length > 0 ? (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {newsItems.map((news, index) => (
                        <div key={index} className={`p-3 rounded-lg border ${getSentimentBg(news.sentimentScore || 0)}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <a 
                                href={news.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="font-semibold text-gray-900 text-sm mb-1 hover:text-indigo-600 block"
                              >
                                {news.title || news.headline}
                              </a>
                              {(news.description || news.content) && (
                                <p className="text-xs text-gray-600 line-clamp-2 mb-2">{news.description || news.content}</p>
                              )}
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span className="font-medium">{news.source}</span>
                                <span>•</span>
                                <span>{new Date(news.publishedAt || news.timestamp).toLocaleString()}</span>
                              </div>
                            </div>
                            {news.sentimentScore !== undefined && (
                              <div className={`flex flex-col items-center gap-1 ${getSentimentColor(news.sentimentScore)}`}>
                                {getSentimentIcon(news.sentimentScore)}
                                <span className="text-xs font-semibold">{news.sentimentScore.toFixed(2)}</span>
                                <span className="text-xs uppercase">{news.sentimentLabel}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Newspaper className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-500 font-medium mb-1">No related articles found</p>
                      <p className="text-xs text-gray-400">Showing featured market news</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-md p-20 text-center w-full max-w-3xl">
                  <Activity className="w-20 h-20 mx-auto mb-6 text-gray-300" />
                  <h3 className="text-2xl font-semibold text-gray-900 mb-2">Select a Stock</h3>
                  <p className="text-gray-600">Choose a stock from the list to view detailed analysis, AI predictions, and news</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;