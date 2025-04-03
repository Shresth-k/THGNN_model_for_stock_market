import React, { useState, useEffect } from 'react';
import { Settings, Star, Share2, ChevronDown, LineChart } from 'lucide-react';
import StockChart from './components/stockchart';
import { VolumeChart, PriceRangeChart } from './components/BarCharts';
import AreaChart from './components/AreaCharts';
import { SentimentChart } from './components/SentimentCharts';
import { ScatterPlot } from './components/ScatterPlots';
import StockNetworkGraph from './components/stocknetworkgraph';

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedStock, setSelectedStock] = useState('ADANIENT');
  const [stockData, setStockData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');

  // Fetch stock data when selected stock changes
  // Inside the useEffect for fetching stock data
  useEffect(() => {
    const fetchStockData = async () => {
      try {
        setLoading(true);
        
        // Fetch CSV data
        const response = await fetch(`/src/stocks/${selectedStock}.csv`);
        if (!response.ok) {
          throw new Error(`Failed to fetch data for ${selectedStock}`);
        }
        
        const csvText = await response.text();
        
        // Parse CSV
        const rows = csvText.split('\n');
        const headers = rows[0].split(',').map(h => h.trim()); // Trim whitespace from headers
        
        // Find the indices of the required columns (case-insensitive)
        const dateIndex = headers.findIndex(h => h.toLowerCase() === 'date');
        const openIndex = headers.findIndex(h => h.toLowerCase() === 'open');
        const highIndex = headers.findIndex(h => h.toLowerCase() === 'high');
        const lowIndex = headers.findIndex(h => h.toLowerCase() === 'low');
        const closeIndex = headers.findIndex(h => h.toLowerCase() === 'close');
        const volumeIndex = headers.findIndex(h => h.toLowerCase() === 'volume');
        const rsiIndex = headers.findIndex(h => h.toLowerCase() === 'rsi');
        const macdIndex = headers.findIndex(h => h.toLowerCase() === 'macd');
        const signalLineIndex = headers.findIndex(h => 
          h.toLowerCase().includes('signal') // More flexible matching
        );
        
        console.log("Found signal line index:", signalLineIndex);
        console.log("Headers:", headers);
        
        // Parse the data rows
        const parsedData = rows.slice(1)
          .filter(row => row.trim() !== '')
          .map(row => {
            const values = row.split(',');
            if (values.length < 7) return null;
            
            // Format date from DD-MM-YYYY to YYYY-MM-DD
            const dateParts = values[dateIndex].split('-');
            if (dateParts.length !== 3) return null;
            
            const day = dateParts[0];
            const month = dateParts[1];
            const year = dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2];
            const formattedDate = `${year}-${month}-${day}`;
            
            return {
              date: formattedDate,
              open: parseFloat(values[openIndex]),
              high: parseFloat(values[highIndex]),
              low: parseFloat(values[lowIndex]),
              close: parseFloat(values[closeIndex]),
              volume: parseFloat(values[volumeIndex]),
              rsi: rsiIndex >= 0 ? parseFloat(values[rsiIndex]) : undefined,
              macd: macdIndex >= 0 ? parseFloat(values[macdIndex]) : undefined,
              signal_line: signalLineIndex >= 0 ? parseFloat(values[signalLineIndex]) : undefined,
              priceRange: parseFloat(values[highIndex]) - parseFloat(values[lowIndex]),
              isUp: parseFloat(values[closeIndex]) > parseFloat(values[openIndex])
            };
          })
          .filter(item => item !== null) as any[];
        
        console.log("First parsed item:", parsedData[0]);
        setStockData(parsedData);
      } catch (error) {
        console.error(`Error loading data for ${selectedStock}:`, error);
      } finally {
        setLoading(false);
      }
    };
    
    // Call the function to fetch data
    fetchStockData();
  }, [selectedStock]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header - Reduced height and size */}
      <header className="border-b border-gray-700 py-2">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <LineChart className="w-5 h-5" />
            <h1 className="text-lg font-semibold">THGNN Stock Predictor Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Share2 className="w-4 h-4 cursor-pointer hover:text-blue-400" />
            <Star className="w-4 h-4 cursor-pointer hover:text-yellow-400" />
            <button className="flex items-center space-x-1 bg-gray-800 px-2 py-1 rounded-lg hover:bg-gray-700 text-sm">
              <Settings className="w-3 h-3" />
              <span>Settings</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Code Window - Removed the title bar and adjusted padding */}
        <div className="flex-1 border-r border-gray-700 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto bg-gray-900 p-4 pt-2 flex flex-col">
            {/* Stock Chart Component - Shifted up by removing the title bar */}
            <div className="flex-1 border border-gray-700 rounded-lg overflow-hidden" style={{ minHeight: "500px" }}>
              <StockChart stockSymbol={selectedStock} onStockChange={setSelectedStock} />
            </div>
          </div>
        </div>

        {/* Analysis Panel - Reduced width from 600px to 500px */}
        <div className="w-[500px] bg-gray-800 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between overflow-x-auto">
            <div className="flex space-x-4 min-w-max">
              <button 
                className={`pb-2 ${activeTab === 'overview' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button 
                className={`pb-2 ${activeTab === 'model' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setActiveTab('model')}
              >
                Model
              </button>
              {/* <button 
                className={`pb-2 ${activeTab === 'predictions' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setActiveTab('predictions')}
              >
                Predictions
              </button> */}
              <button 
                className={`pb-2 ${activeTab === 'analysis' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setActiveTab('analysis')}
              >
                Analysis
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden">
            {activeTab === 'overview' && (
              <div className="p-4 space-y-6 h-full overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
                {loading ? (
                  <div className="flex justify-center items-center h-40">
                    <div className="text-gray-400">Loading data...</div>
                  </div>
                ) : (
                  <>
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Chart Type</h3>
                        <div className="flex space-x-2">
                          <button 
                            className={`px-3 py-1 rounded-md ${chartType === 'bar' ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-300'}`}
                            onClick={() => setChartType('bar')}
                          >
                            Bar
                          </button>
                          <button 
                            className={`px-3 py-1 rounded-md ${chartType === 'area' ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-300'}`}
                            onClick={() => setChartType('area')}
                          >
                            Area
                          </button>
                        </div>
                      </div>
                      
                      {chartType === 'bar' ? (
                        <>
                          <div className="bg-gray-700 p-4 rounded-lg">
                            <h3 className="text-lg font-semibold mb-4">Volume Analysis</h3>
                            <div className="flex justify-center">
                              <VolumeChart 
                                data={stockData} 
                                height={250} 
                                stockSymbol={selectedStock}
                              />
                            </div>
                          </div>
                          
                          <div className="bg-gray-700 p-4 rounded-lg">
                            <h3 className="text-lg font-semibold mb-4">Price Range (High - Low)</h3>
                            <div className="flex justify-center">
                              <PriceRangeChart 
                                data={stockData} 
                                height={250} 
                                stockSymbol={selectedStock}
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-gray-700 p-4 rounded-lg mb-6">
                            <div className="flex justify-center">
                              <AreaChart 
                                data={stockData} 
                                height={200} 
                                stockSymbol={selectedStock}
                                type="price"
                                title="Price Trend"
                              />
                            </div>
                          </div>
                          
                          <div className="bg-gray-700 p-4 rounded-lg mb-6">
                            <div className="flex justify-center">
                              <AreaChart 
                                data={stockData} 
                                height={200} 
                                stockSymbol={selectedStock}
                                type="volume"
                                title="Volume Trend"
                              />
                            </div>
                          </div>
                          
                          {/* Updated Sentiment Charts */}
                          <div className="bg-gray-700 p-4 rounded-lg mb-6">
                            <div className="flex justify-center w-full">
                              <SentimentChart 
                                data={stockData} 
                                height={200} 
                                stockSymbol={selectedStock}
                                type="rsi"
                              />
                            </div>
                          </div>
                          
                          <div className="bg-gray-700 p-4 rounded-lg">
                            <div className="flex justify-center w-full">
                              <SentimentChart 
                                data={stockData} 
                                height={200} 
                                stockSymbol={selectedStock}
                                type="macd"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Keep the other tabs unchanged */}
            {activeTab === 'model' && (
              <div className="p-4 space-y-6 h-full overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
                {/* <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Model Architecture</h3>
                  <div className="flex justify-center">
                    <img 
                      src="/assets/model_architecture.png" 
                      alt="Model Architecture" 
                      className="w-full max-w-full object-contain rounded"
                      style={{ maxHeight: "calc(100vh - 300px)" }}
                    />
                  </div>
                </div> */}
                
                {/* Stock Network Graph */}
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Stock Relationship Network</h3>
                  <div className="text-sm text-gray-400 mb-4">
                    This network graph shows relationships between different stocks based on correlation patterns and sector relationships.
                  </div>
                  <StockNetworkGraph />
                </div>
                
                {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">Training Loss</h3>
                    <div id="loss-chart" style={{ height: '300px' }}></div>
                  </div>
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">Price Distribution</h3>
                    <div id="distribution-chart" style={{ height: '300px' }}></div>
                  </div>
                </div> */}
                
                {/* <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Prediction Performance</h3>
                  <div id="prediction-chart" style={{ height: '300px' }}></div>
                </div> */}
              </div>
            )}

            {/* Keep the predictions tab unchanged */}
            {/* {activeTab === 'predictions' && (
              <div className="p-4 space-y-6 h-full overflow-y-auto" style={{ maxHeight: "calc(100vh - 150px)" }}>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Prediction Performance</h3>
                  <div className="flex justify-center">
                    <img 
                      src="/assets/error_metrics.png" 
                      alt="Prediction Performance" 
                      className="w-full max-w-full object-contain rounded"
                      style={{ maxHeight: "calc(100vh - 300px)" }}
                    />
                  </div>
                </div>
                
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Metrics</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>RMSE</span>
                      <span>0.0927</span>
                    </div>
                    <div className="flex justify-between">
                      <span>MAE</span>
                      <span>0.0629</span>
                    </div>
                    <div className="flex justify-between">
                      <span>R²</span>
                      <span>0.9811</span>
                    </div>
                  </div>
                </div>
              </div>
            )} */}

            {/* Updated Analysis tab with scatter plots */}
            
            {activeTab === 'analysis' && (
            <div className="p-4 space-y-6 h-full overflow-y-auto" style={{ maxHeight: "calc(100vh - 150px)" }}>
            {/* <div className="bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Price Trends</h3>
            <div className="flex justify-center">
            <img 
            src="/assets/rsi_macd.png" 
            alt="Price Trends Analysis" 
            className="w-full max-w-full object-contain rounded"
            style={{ maxHeight: "calc(100vh - 300px)" }}
            />
            </div>
            </div> */}
            
            {/* Volatility Scatter Plot */}
            <div className="bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Volatility Analysis</h3>
            <div className="text-sm text-gray-400 mb-4">
            This chart shows daily percentage changes over time, highlighting periods of high volatility.
            </div>
            <div className="flex justify-center">
            {!loading && stockData.length > 0 && (
            <ScatterPlot 
            data={stockData} 
            height={280} 
            stockSymbol={selectedStock}
            type="volatility"
            />
            )}
            </div>
            </div>
            
            {/* Correlation Scatter Plot */}
            <div className="bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Volume-Price Correlation</h3>
            <div className="text-sm text-gray-400 mb-4">
            This scatter plot shows the relationship between trading volume and price changes.
            </div>
            <div className="flex justify-center">
            {!loading && stockData.length > 0 && (
            <ScatterPlot 
            data={stockData} 
            height={350} 
            stockSymbol={selectedStock}
            type="correlation"
            />
            )}
            </div>
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