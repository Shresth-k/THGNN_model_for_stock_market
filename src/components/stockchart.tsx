import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData } from 'lightweight-charts';
import Select from 'react-select';
import axios from 'axios';

interface StockChartProps {
  stockSymbol: string;
  onStockChange: (symbol: string) => void;
}

const stocks = [
  'ADANIENT', 'ASIANPAINT', 'AXISBANK', 'BAJAJ-AUTO', 'BAJAJFINSV',
  'BAJFINANCE', 'BPCL', 'BRITANNIA', 'CIPLA', 'COALINDIA',
  'DIVISLAB', 'EICHERMOT', 'GRASIM', 'HCLTECH', 'HDFCBANK',
  'HDFCLIFE', 'HEROMOTOCO', 'HINDALCO', 'HINDUNILVR', 'ICICIBANK',
  'INDUSINDBK', 'INFY', 'ITC', 'JSWSTEEL', 'KOTAKBANK',
  'LT', 'M&M', 'MARUTI', 'NTPC', 'ONGC',
  'POWERGRID', 'RELIANCE', 'SBILIFE', 'SBIN', 'SUNPHARMA',
  'TATACONSUM', 'TATAMOTORS', 'TCS', 'TECHM', 'ULTRACEMCO',
  'UPL', 'WIPRO'
];

const stockOptions = stocks.map(stock => ({ value: stock, label: stock }));

const StockChart: React.FC<StockChartProps> = ({ stockSymbol, onStockChange }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [candleSeries, setCandleSeries] = useState<ISeriesApi<"Candlestick"> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Add state for latest price and prediction
  const [latestPrice, setLatestPrice] = useState<number | null>(null);
  const [predictedPrice, setPredictedPrice] = useState<number | null>(null);
  const [priceDate, setPriceDate] = useState<string | null>(null);

  useEffect(() => {
    if (chartContainerRef.current) {
      // Clear any existing chart
      if (chart) {
        chart.remove();
      }

      const newChart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 500, // Fixed height for better visibility
        layout: {
          background: { color: '#1E1E30' },
          textColor: '#DDD',
          fontSize: 12,
        },
        grid: {
          vertLines: { color: '#2B2B43' },
          horzLines: { color: '#2B2B43' },
        },
        timeScale: {
          borderColor: '#2B2B43',
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: '#6B7280',
            width: 1,
            style: 1,
            visible: true,
            labelVisible: true,
          },
          horzLine: {
            color: '#6B7280',
            width: 1,
            style: 1,
            visible: true,
            labelVisible: true,
          },
        },
      });

      const newSeries = newChart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });

      setChart(newChart);
      setCandleSeries(newSeries);

      // Handle resize
      const handleResize = () => {
        if (chartContainerRef.current && newChart) {
          newChart.applyOptions({ 
            width: chartContainerRef.current.clientWidth 
          });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        newChart.remove();
      };
    }
  }, []);

  useEffect(() => {
    const fetchStockData = async () => {
      if (!candleSeries) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Fetch real data from the stocks directory
        const response = await fetch(`/src/stocks/${stockSymbol}.csv`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data for ${stockSymbol}`);
        }
        
        const csvText = await response.text();
        
        // Parse CSV
        const rows = csvText.split('\n');
        const headers = rows[0].split(',');
        
        // Find the indices of the required columns
        const dateIndex = headers.indexOf('date');
        const openIndex = headers.indexOf('open');
        const highIndex = headers.indexOf('high');
        const lowIndex = headers.indexOf('low');
        const closeIndex = headers.indexOf('close');
        
        if (dateIndex === -1 || openIndex === -1 || highIndex === -1 || lowIndex === -1 || closeIndex === -1) {
          throw new Error('CSV file is missing required columns');
        }
        
        // Parse the data rows
        const dataPoints = rows.slice(1)
          .filter(row => row.trim() !== '')
          .map(row => {
            const values = row.split(',');
            
            // Format date from DD-MM-YYYY to YYYY-MM-DD for the chart
            const dateParts = values[dateIndex].split('-');
            if (dateParts.length !== 3) {
              return null; // Skip invalid date formats
            }
            
            // Properly format the date from DD-MM-YYYY to YYYY-MM-DD
            const day = dateParts[0];
            const month = dateParts[1];
            const year = dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2];
            const formattedDate = `${year}-${month}-${day}`;
            
            const open = parseFloat(values[openIndex]);
            const high = parseFloat(values[highIndex]);
            const low = parseFloat(values[lowIndex]);
            const close = parseFloat(values[closeIndex]);
            
            // Skip rows with invalid numerical data
            if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
              return null;
            }
            
            return {
              time: formattedDate,
              open,
              high,
              low,
              close,
            } as CandlestickData;
          })
          .filter(dataPoint => dataPoint !== null) as CandlestickData[];
        
        if (dataPoints.length === 0) {
          throw new Error('No valid data points found in the CSV file');
        }
        
        // Set the data to the chart
        candleSeries.setData(dataPoints);
        
        // Get the latest price and date for the prediction panel
        const latestDataPoint = dataPoints[dataPoints.length - 1];
        setLatestPrice(latestDataPoint.close);
        setPriceDate(latestDataPoint.time);
        
        // Simulate a prediction (this will be replaced with API call later)
        // For now, just add a small random adjustment to the latest price
        const randomAdjustment = (Math.random() * 0.04) - 0.02; // -2% to +2%
        setPredictedPrice(latestDataPoint.close * (1 + randomAdjustment));
        
        // Fit content to view - but limit to showing only the most recent 35 candles initially
        if (chart) {
          // First fit all content to make sure everything is loaded
          chart.timeScale().fitContent();
          
          // Then set visible range to show only the most recent 35 candles
          const visibleLogicalRange = {
            from: Math.max(0, dataPoints.length - 35),
            to: dataPoints.length
          };
          chart.timeScale().setVisibleLogicalRange(visibleLogicalRange);
        }
      } catch (error) {
        console.error(`Error loading data for ${stockSymbol}:`, error);
        setError(error instanceof Error ? error.message : 'Unknown error loading data');
      } finally {
        setLoading(false);
      }
    };

    if (candleSeries && stockSymbol) {
      fetchStockData();
    }
  }, [stockSymbol, candleSeries, chart]);

  const handleStockChange = (option: any) => {
    if (option) {
      onStockChange(option.value);
    }
  };

  // Add state for prediction data
  const [predictionData, setPredictionData] = useState<any>(null);
  const [predictionLoading, setPredictionLoading] = useState<boolean>(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  // Add useEffect to fetch prediction data when stock symbol changes
  useEffect(() => {
    const fetchPredictionData = async () => {
      setPredictionLoading(true);
      setPredictionError(null);
      
      try {
        const response = await axios.get(`http://localhost:5000/api/prediction/${stockSymbol}`);
        
        if (response.data.status === 'success') {
          setPredictionData(response.data);
        } else {
          throw new Error(response.data.error || 'Failed to fetch prediction data');
        }
      } catch (error) {
        console.error(`Error fetching prediction for ${stockSymbol}:`, error);
        setPredictionError(error instanceof Error ? error.message : 'Unknown error fetching prediction');
      } finally {
        setPredictionLoading(false);
      }
    };

    if (stockSymbol) {
      fetchPredictionData();
    }
  }, [stockSymbol]);

  // Format price with 2 decimal places
  const formatPrice = (price: number | null) => {
    if (price === null) return "N/A";
    return price.toFixed(2);
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col w-full h-full">
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Stock Price Chart</h3>
          <div className="w-64 z-50">
            <Select
              options={stockOptions}
              value={stockOptions.find(option => option.value === stockSymbol)}
              onChange={handleStockChange}
              className="text-gray-900"
              classNamePrefix="select"
              isSearchable
              placeholder="Select a stock..."
              styles={{
                control: (base) => ({
                  ...base,
                  background: "#1f2937",
                  borderColor: "#4b5563",
                  boxShadow: "none",
                  "&:hover": {
                    borderColor: "#6b7280"
                  }
                }),
                menu: (base) => ({
                  ...base,
                  background: "#1f2937",
                  zIndex: 100
                }),
                option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isSelected ? "#3b82f6" : state.isFocused ? "#374151" : "#1f2937",
                  color: "white",
                  "&:hover": {
                    backgroundColor: "#374151"
                  }
                }),
                singleValue: (base) => ({
                  ...base,
                  color: "white"
                }),
                input: (base) => ({
                  ...base,
                  color: "white"
                }),
                placeholder: (base) => ({
                  ...base,
                  color: "#9ca3af"
                })
              }}
            />
          </div>
        </div>
      </div>
      <div className="flex-1 flex">
        {/* Removed any potential gap by ensuring the divs are directly adjacent */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-70 z-10">
              <div className="text-white">Loading chart data...</div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-70 z-10">
              <div className="text-red-400 p-4 bg-gray-800 rounded-lg">
                <h4 className="font-bold mb-2">Error Loading Data</h4>
                <p>{error}</p>
              </div>
            </div>
          )}
          <div 
            ref={chartContainerRef} 
            className="w-full h-full"
          />
        </div>
        
        {/* Prediction Panel - Removed any margin/padding that might cause a gap */}
        <div className="w-64 border-l border-gray-700 bg-gray-800">
          <h3 className="text-lg font-semibold text-white p-4 border-b border-gray-700">Price Prediction</h3>
          
          {loading ? (
            <div className="p-4 text-gray-400 text-sm">Loading prediction data...</div>
          ) : predictionError ? (
            <div className="p-4 text-red-400 text-sm">
              <p className="font-semibold">Error:</p>
              <p>{predictionError}</p>
            </div>
          ) : predictionData ? (
            <div className="p-4 space-y-6">
              <div>
                <h4 className="text-sm text-gray-400 mb-1">Latest Price</h4>
                <div className="flex items-baseline">
                  <span className="text-xl font-bold text-white">{formatPrice(predictionData.latest_price)}</span>
                  <span className="text-xs ml-2 text-gray-400">
                    {formatDate(predictionData.latest_date)}
                  </span>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm text-gray-400 mb-1">Prediction Direction</h4>
                <div className="flex items-center space-x-2">
                  {predictionData.percent_change > 0 ? (
                    <div className="flex items-center">
                      <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      <span className="text-lg font-bold text-green-500 ml-1">UP</span>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span className="text-lg font-bold text-red-500 ml-1">DOWN</span>
                    </div>
                  )}
                </div>
                <div className="mt-1">
                  <span className="text-xs text-gray-400">
                    For {formatDate(predictionData.predicted_date)}
                  </span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-700">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-400">Threshold Accuracy:</span>
                  <span className="text-xs font-semibold text-blue-400">62%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '62%' }}></div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Prediction based on THGNN model analysis.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 text-gray-400 text-sm">No prediction data available</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockChart;